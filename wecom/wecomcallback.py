from flask import Flask, request, jsonify
import hashlib
import xml.etree.ElementTree as ET
import base64
from Cryptodome.Cipher import AES
import struct
import sys
import os
import json
from datetime import datetime, timedelta, date, time as dt_time_obj
import requests
from dateutil import parser
from collections import defaultdict

# --- 1. กำหนดค่า WeCom 

WECOM_CORP_ID = "ww079b6b868ed626cb"
WECOM_AGENT_ID = 1000002 
WECOM_AGENT_SECRET = "8FZ5KdIZZDmyr7p3PSBMXwG_X_tyzQN0jSPLrKEQHRE"

WECOM_TOKEN = "yNCLmfPk5Cdyf2DKFE4XnujPWQQ1P8E"
WECOM_ENCODING_AES_KEY = "wmtlQLXrsJd5mWvzzFwf2TMJvIJYQsH6Rt5WBALhfNo"

# Backend API Endpoints (จาก wecomsend.py)
EMPLOYEE_ACTIVE_API = "http://10.35.10.47:2007/api/LineNotify/EmployeeActive"
LINE_USERS_API = "http://10.35.10.47:2007/api/LineUsers"
DAILY_SCANS_API = "http://10.35.10.47:2007/api/LineNotify/ScanSummary" 
SCAN_SUMMARY_DEPARTMENT_API = "http://10.35.10.47:2007/api/LineNotify/ScanSummaryDepartment" 

app = Flask(__name__)

# --- ฟังก์ชันช่วยถอดรหัสและเข้ารหัสข้อความ ---
class WeComCrypto:
    def __init__(self, token, encoding_aes_key, corp_id):
        self.token = token
        self.key = base64.b64decode(encoding_aes_key + '=')
        self.corp_id = corp_id
        if len(self.key) not in [16, 24, 32]:
            raise Exception("EncodingAESKey length must be 16, 24, or 32 bytes")

    def _unpad(self, s):
        nl = ord(s[-1])
        return s[:-nl]

    def decrypt(self, encrypted_msg):
        cipher = AES.new(self.key, AES.MODE_CBC, self.key[:16])
        decrypted = cipher.decrypt(base64.b64decode(encrypted_msg))
        pad = decrypted[-1]
        content = decrypted[16:-pad]
        xml_len = struct.unpack("!I", content[:4])[0]
        xml_content = content[4: 4 + xml_len].decode('utf-8')
        from_corp_id = content[4 + xml_len:].decode('utf-8')
        if from_corp_id != self.corp_id:
            raise Exception("Corp ID mismatch")
        return xml_content

wecom_crypto = WeComCrypto(WECOM_TOKEN, WECOM_ENCODING_AES_KEY, WECOM_CORP_ID)

# --- GET Access Token ---
def get_access_token():
    url = f"https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid={WECOM_CORP_ID}&corpsecret={WECOM_AGENT_SECRET}"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        if data.get("errcode") == 0:
            return data.get("access_token")
        else:
            print(f"Error getting WeCom access token: {data.get('errmsg')}")
            return None
    except Exception as e:
        print(f"Error get_access_token: {e}")
        return None

# --- ส่งข้อความกลับ WeCom ---
def send_wecom_message(access_token, user_id, message_content):
    if not access_token:
        return False
    url = f"https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token={access_token}"
    payload = {
        "touser": user_id,
        "msgtype": "text",
        "agentid": WECOM_AGENT_ID,
        "text": {"content": message_content},
        "safe": 0
    }
    try:
        response = requests.post(url, json=payload, timeout=10)
        data = response.json()
        if data.get("errcode") == 0:
            return True
        else:
            print("Send msg error:", data)
            return False
    except Exception as e:
        print(f"Error send_wecom_message: {e}")
        return False

# --- Endpoint หลัก ---
@app.route('/wecom-webhook', methods=['GET', 'POST'])
def wecom_webhook():
    signature = request.args.get('msg_signature')
    timestamp = request.args.get('timestamp')
    nonce = request.args.get('nonce')
    echostr = request.args.get('echostr')

    # ✅ แก้ส่วน Verify URL ให้ถูกต้อง
    if request.method == 'GET':
        print(f"[Verify] echostr={echostr}")
        params = [WECOM_TOKEN, timestamp, nonce, echostr]
        params.sort()
        sha = hashlib.sha1()
        sha.update(''.join(params).encode('utf-8'))
        calc_sig = sha.hexdigest()
        if calc_sig == signature:
            print("[Verify] SUCCESS")
            return echostr, 200  # ✅ คืน echostr ตรงๆ
        else:
            print(f"[Verify] Signature mismatch! expect={signature} got={calc_sig}")
            return "Signature mismatch", 400

    # ✅ รับ POST message
    elif request.method == 'POST':
        try:
            xml_data = ET.fromstring(request.data)
            encrypted_msg = xml_data.find('Encrypt').text
            decrypted_xml_str = wecom_crypto.decrypt(encrypted_msg)
            msg_root = ET.fromstring(decrypted_xml_str)

            msg_type = msg_root.find('MsgType').text
            from_user_id = msg_root.find('FromUserName').text
            received_text = msg_root.find('Content').text if msg_type == 'text' else ''

            print(f"[POST] from={from_user_id} type={msg_type} text={received_text}")

            reply_text = "ไม่เข้าใจคำสั่งค่ะ"
            if received_text == 'ping':
                reply_text = "pong"

            access_token = get_access_token()
            if access_token:
                send_wecom_message(access_token, from_user_id, reply_text)
            return "success", 200
        except Exception as e:
            print(f"Error processing POST: {e}")
            return "fail", 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
