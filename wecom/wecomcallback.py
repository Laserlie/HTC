import hashlib
import xml.etree.ElementTree as ET
import base64
import struct
import logging
import sys
import json
import time
import requests
from datetime import datetime
from flask import Flask, request, jsonify
from Cryptodome.Cipher import AES
import uuid
import collections

# ตั้งค่าพื้นฐาน   
app = Flask(__name__)
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

# ค่าตั้งค่า WeCom
WECOM_CORP_ID = "ww079b6b868ed626cb"
WECOM_AGENT_ID = 1000002
WECOM_AGENT_SECRET = "8FZ5KdIZZDmyr7p3PSBMXwG_X_tyzQN0jSPLrKEQHRE"
WECOM_TOKEN = "rmWBvuImv8KA"
WECOM_ENCODING_AES_KEY = "5uJEq9E7Z2A7naPQmUDgQjfFtV4Dcv6SstMflcRttRH"

# --- สำหรับ Idempotency (ป้องกันข้อความซ้ำซ้อน) ---
MAX_SEEN_MESSAGES = 1000 # จำนวนข้อความสูงสุดที่เก็บใน deque
SEEN_MESSAGE_TTL_SECONDS = 10 # ระยะเวลา (วินาที) ที่ข้อความจะถูกจดจำว่า "เคยเห็นแล้ว"
SEEN_MESSAGE_IDS = collections.deque() # เก็บ (msg_id, timestamp)

# --- API Endpoints ---
LINE_USERS_API = "http://10.35.10.47:2007/api/LineUsers"
EMPLOYEE_ACTIVE_API = "http://10.35.10.47:2007/api/LineNotify/EmployeeActive"
SCAN_SUMMARY_DEPARTMENT_API = "http://10.35.10.47:2007/api/LineNotify/ScanSummaryDepartment"
SCAN_DETAIL_API = "http://10.35.10.47:2007/api/LineNotify/ScanDetailDepartment"
SCAN_SUMMARY_PERSONAL_API = "http://10.35.10.47:2007/api/LineNotify/ScanSummary"
COMPANY_HOLIDAYS_API = "http://10.35.10.47:2007/api/LineNotify/CompanyHolidays"

class WeComCrypto:
    def __init__(self, token, encoding_aes_key, corp_id):
        self.token = token                          
        try:
            padded_key = encoding_aes_key + '=' * (4 - len(encoding_aes_key) % 4)
            self.key = base64.b64decode(padded_key)
            if len(self.key) != 32: # AES-256 key should be 32 bytes
                raise ValueError("Invalid EncodingAESKey length after Base64 decode. Expected 32 bytes.")
        except Exception as e:
            logging.error(f"Failed to decode or validate EncodingAESKey: {e}")
            raise

        self.corp_id = corp_id
        logging.info(f"WeComCrypto initialized. Key length: {len(self.key)} bytes")

    def _unpad(self, s):
        if not s:
            raise ValueError("Input to _unpad is empty.")
        padding_len = s[-1]
        
        if padding_len == 0 or padding_len > len(s):
            raise ValueError(f"Invalid padding length: {padding_len}. Decrypted data might be corrupt.")
        return s[:-padding_len]

    def decrypt_message(self, encrypted_msg):
        encrypted_msg = encrypted_msg.strip()
        missing_padding = len(encrypted_msg) % 4
        if missing_padding != 0:
            encrypted_msg += '=' * (4 - missing_padding)
        logging.debug(f"[_decrypt_message] Adjusted encrypted_msg (first 50 chars): '{encrypted_msg[:50]}...' (length: {len(encrypted_msg)})")

        cipher = AES.new(self.key, AES.MODE_CBC, self.key[:16])

        try:
            decoded_base64 = base64.b64decode(encrypted_msg)
            logging.debug(f"[_decrypt_message] Length of decoded_base64: {len(decoded_base64)}")
        except Exception as e:
            logging.error(f"[_decrypt_message] Base64 decoding failed for string: '{encrypted_msg[:50]}...' - Error: {e}", exc_info=True)
            raise

        try:
            decrypted = cipher.decrypt(decoded_base64)
            logging.debug(f"[_decrypt_message] Decrypted padded content length: {len(decrypted)}")
            logging.debug(f"[_decrypt_message] Raw decrypted bytes (first 50 chars, hex): {decrypted[:50].hex()}") # เพิ่มบรรทัดนี้เพื่อดู raw bytes
        except ValueError as e:
            logging.error(f"[_decrypt_message] AES decryption failed: {e}", exc_info=True)
            raise

        try:
            unpadded = self._unpad(decrypted)
            logging.debug(f"[_decrypt_message] Unpadded content length: {len(unpadded)}")
        except ValueError as e:
            logging.error(f"[_decrypt_message] Unpadding failed: {e}. Decrypted raw bytes (first 50 chars, hex): {decrypted[:50].hex()}", exc_info=True)
            raise

        if len(unpadded) < 20: # Random string (16) + msg_len (4)
            raise ValueError(f"[_decrypt_message] Decrypted content too short after unpadding: {len(unpadded)} bytes.")

        msg_len = struct.unpack('>I', unpadded[16:20])[0]
        logging.debug(f"[_decrypt_message] Expected XML content length (msg_len): {msg_len}")

        content_start = 20
        content_end = 20 + msg_len

        if len(unpadded) < content_end:
            logging.error(f"[_decrypt_message] Content length mismatch! Unpadded length: {len(unpadded)}, Expected end: {content_end}")
            raise ValueError(f"Content length mismatch. Unpadded content too short to contain full message and Corp ID.")

        content = unpadded[content_start:content_end]
        received_corp_id_bytes = unpadded[content_end:]
        
        
        received_corp_id = received_corp_id_bytes.decode('utf-8') if received_corp_id_bytes else ""
        
        logging.debug(f"[_decrypt_message] Decrypted Content (before final check): {content.decode('utf-8')}")
        logging.debug(f"[_decrypt_message] From Corp ID extracted: '{received_corp_id}' (Expected: '{self.corp_id}')")

        if received_corp_id != self.corp_id:
            raise ValueError(f"Corp ID mismatch after decryption. Expected '{self.corp_id}', got '{received_corp_id}'")
        return content.decode('utf-8')


def get_access_token():
    try:
        get_token_url = f"https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid={WECOM_CORP_ID}&corpsecret={WECOM_AGENT_SECRET}"
        token_response = requests.get(get_token_url)
        token_response.raise_for_status()
        access_token = token_response.json().get('access_token')

        if not access_token:
            logging.error("Failed to get WeCom access token.")
            return None
        return access_token
    except requests.exceptions.RequestException as e:
        logging.error(f"Error getting WeCom access token: {e}")
        return None
    except json.JSONDecodeError as e:
        logging.error(f"Error decoding JSON from WeCom token API: {e}")
        return None

def send_wecom_message(to_user, message_content, request_id="N/A"):
    access_token = get_access_token()
    if not access_token:
        logging.error(f"[{request_id}] ไม่สามารถส่งข้อความตอบกลับได้: ไม่ได้รับ Access Token")
        return False

    logging.info(f"[{request_id}] ได้รับ Access Token จาก WeCom สำเร็จ")

    send_message_url = f"https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token={access_token}"

    headers = {'Content-Type': 'application/json'}
    payload = {
        "touser": to_user,
        "msgtype": "text",
        "agentid": WECOM_AGENT_ID,
        "text": {
            "content": message_content
        },
        "safe": 0
    }

    try: 
        response = requests.post(send_message_url, headers=headers, data=json.dumps(payload))
        response.raise_for_status() 

        result = response.json()
        if result.get('errcode') == 0:
            logging.info(f"[{request_id}] ส่งข้อความไปยัง {to_user} สำเร็จ")
            return True
        else:
            logging.error(f"[{request_id}] Failed to send message to {to_user}: {result.get('errmsg')}")
            return False

    except requests.exceptions.RequestException as e:
        logging.error(f"[{request_id}] Error sending WeCom message: {e}")
        return False
    except json.JSONDecodeError as e:
        logging.error(f"[{request_id}] Error decoding JSON from WeCom message API: {e}")
        return False

def get_workday_id_from_wecom_id(wecom_id, request_id="N/A"):
    try:
        response = requests.get(LINE_USERS_API)
        response.raise_for_status()
        users_data = response.json()
        logging.debug(f"[{request_id}] LINE_USERS_API Response: {users_data}")

        for user in users_data:
            api_wecom_id = user.get('weComId')
            if api_wecom_id is not None and str(api_wecom_id).strip() == wecom_id.strip():
                return user.get('workdayId')

        logging.warning(f"[{request_id}] ไม่พบ workdayId สำหรับ WeCom ID {wecom_id} ใน LINE_USERS_API response list.")
        return None
    except requests.exceptions.RequestException as e:
        logging.error(f"[{request_id}] Error calling LINE_USERS_API: {e}")
        return None
    except json.JSONDecodeError as e:
        logging.error(f"[{request_id}] Error decoding JSON from LINE_USERS_API: {e}")
        return None

def get_employee_dept_info(workday_id, request_id="N/A"):
    """
    Retrieves user's department code, employee name, and department name.
    Returns (user_dept_code, user_emp_name, user_dept_name)
    """
    try:
        employee_active_params = {'workdayIds': workday_id}
        emp_response = requests.get(EMPLOYEE_ACTIVE_API, params=employee_active_params)
        emp_response.raise_for_status()
        emp_data = emp_response.json()
        logging.debug(f"[{request_id}] EMPLOYEE_ACTIVE_API response for single user: {emp_data}")

        user_dept_code = None
        user_emp_name = None
        user_dept_name = None # เพิ่มตัวแปรสำหรับชื่อแผนก

        if emp_data and isinstance(emp_data, list):
            for emp_entry in emp_data:
                if str(emp_entry.get('workdayId')) == workday_id:
                    user_dept_code = emp_entry.get('deptCode')
                    user_emp_name = emp_entry.get('empName')
                    user_dept_name = emp_entry.get('deptName') # ดึง deptName จาก API response
                    break
        logging.debug(f"[{request_id}] User Dept Code: {user_dept_code}, User Emp Name: {user_emp_name}, User Dept Name: {user_dept_name}")
        return user_dept_code, user_emp_name, user_dept_name # ส่งกลับ deptName ด้วย
    except requests.exceptions.RequestException as e:
        logging.error(f"[{request_id}] Error calling EMPLOYEE_ACTIVE_API for single user: {e}")
        return None, None, None
    except json.JSONDecodeError as e:
        logging.error(f"[{request_id}] JSON Decode Error from EMPLOYEE_ACTIVE_API (single user): {e}")
        return None, None, None

def get_all_workday_ids_by_dept_code(user_dept_code, request_id="N/A"):
    try:
        all_employee_response = requests.get(EMPLOYEE_ACTIVE_API)
        all_employee_response.raise_for_status()
        all_employees_data = all_employee_response.json()
        logging.debug(f"[{request_id}] All EMPLOYEE_ACTIVE_API response (first 3 entries): {all_employees_data[:3]}")

        all_workday_ids_in_dept = []
        for emp in all_employees_data:
            if emp.get('deptCode') == user_dept_code:
                all_workday_ids_in_dept.append(str(emp.get('workdayId')))
        logging.debug(f"[{request_id}] Workday IDs in department {user_dept_code}: {all_workday_ids_in_dept}")
        return all_workday_ids_in_dept
    except requests.exceptions.RequestException as e:
        logging.error(f"[{request_id}] Error calling EMPLOYEE_ACTIVE_API for all users: {e}")
        return []
    except json.JSONDecodeError as e:
        logging.error(f"[{request_id}] JSON Decode Error from EMPLOYEE_ACTIVE_API (all users): {e}")
        return []

# --- NEW FUNCTION: get_employees_by_department ---
def get_employees_by_department(dept_code, request_id="N/A"):
    """
    Retrieves a list of employee names and Workday IDs for a given department code.
    """
    try:
        all_employee_response = requests.get(EMPLOYEE_ACTIVE_API)
        all_employee_response.raise_for_status()
        all_employees_data = all_employee_response.json()
        logging.debug(f"[{request_id}] EMPLOYEE_ACTIVE_API response for all employees (get_employees_by_department): {all_employees_data[:5]}")

        employees_in_dept = []
        for emp in all_employees_data:
            if emp.get('deptCode') == dept_code:
                employees_in_dept.append({
                    'empName': emp.get('empName'),
                    'workdayId': emp.get('workdayId')
                })
        logging.debug(f"[{request_id}] Employees in department {dept_code}: {employees_in_dept}")
        return employees_in_dept
    except requests.exceptions.RequestException as e:
        logging.error(f"[{request_id}] Error calling EMPLOYEE_ACTIVE_API in get_employees_by_department: {e}")
        return []
    except json.JSONDecodeError as e:
        logging.error(f"[{request_id}] JSON Decode Error from EMPLOYEE_ACTIVE_API in get_employees_by_department: {e}")
        return []

def get_department_daily_summary(dept_code, scan_date, request_id="N/A"):
    try:
        scan_summary_params = {
            'deptcodes': dept_code,
            'scandate': scan_date
        }
        logging.debug(f"[{request_id}] Calling SCAN_SUMMARY_DEPARTMENT_API with params: {scan_summary_params}")
        summary_response = requests.get(SCAN_SUMMARY_DEPARTMENT_API, params=scan_summary_params)
        summary_response.raise_for_status()
        summary_data = summary_response.json()
        logging.debug(f"[{request_id}] SCAN_SUMMARY_DEPARTMENT_API response: {summary_data}")
        return summary_data
    except requests.exceptions.RequestException as e:
        logging.error(f"[{request_id}] Error calling SCAN_SUMMARY_DEPARTMENT_API: {e}")
        return None
    except json.JSONDecodeError as e:
        logging.error(f"[{request_id}] JSON Decode Error from SCAN_SUMMARY_DEPARTMENT_API: {e}")
        return None

def get_scan_details_for_department(scan_date, workday_ids, request_id="N/A"):
    try:
        scan_detail_params = {
            'scandate': scan_date,
            'workdayIds': workday_ids
        }
        logging.debug(f"[{request_id}] Calling SCAN_DETAIL_API with params: {scan_detail_params}")
        detail_response = requests.get(SCAN_DETAIL_API, params=scan_detail_params)
        detail_response.raise_for_status()
        detail_data = detail_response.json()
        logging.debug(f"[{request_id}] SCAN_DETAIL_API response for department: {detail_data}")
        return detail_data
    except requests.exceptions.RequestException as e:
        logging.error(f"[{request_id}] Error calling SCAN_DETAIL_API: {e}")
        return None
    except json.JSONDecodeError as e:
        logging.error(f"[{request_id}] JSON Decode Error from SCAN_DETAIL_API: {e}")
        return None

# --- Flask Routes ---
@app.route('/wecom-webhook', methods=['GET', 'POST'])
def wecom_webhook():
    request_id = str(uuid.uuid4()) # สร้าง Request ID ที่ไม่ซ้ำกันสำหรับแต่ละ Request

    try:
        if request.method == 'GET':
            msg_signature = request.args.get('msg_signature')
            timestamp = request.args.get('timestamp')
            nonce = request.args.get('nonce')
            echostr = request.args.get('echostr')

            logging.debug(f"[{request_id}] Received GET request: msg_signature={msg_signature}, timestamp={timestamp}, nonce={nonce}, echostr={echostr}")

            if not all([msg_signature, timestamp, nonce, echostr]):
                logging.error(f"[{request_id}] Missing parameters for GET request.")
                return "Missing parameters", 400

            wecom_crypto = WeComCrypto(WECOM_TOKEN, WECOM_ENCODING_AES_KEY, WECOM_CORP_ID)

            try:
                # การตรวจสอบ Signature สำหรับ GET request ต้องใช้ echostr ที่ยังไม่ถอดรหัส
                signature_list = sorted([WECOM_TOKEN, timestamp, nonce, echostr])
                signature_str = "".join(signature_list).encode('utf-8')
                calculated_signature = hashlib.sha1(signature_str).hexdigest()

                logging.debug(f"[{request_id}] Raw signature_str: {signature_str}")
                logging.debug(f"[{request_id}] Calculated signature: {calculated_signature}")
                logging.debug(f"[{request_id}] Received signature: {msg_signature}")            

                if calculated_signature != msg_signature:
                    logging.error(f"[{request_id}] Signature verification failed! Calculated: {calculated_signature}, Received: {msg_signature}")
                    return "Signature verification failed", 401

                
                decrypted_content = wecom_crypto.decrypt_message(echostr)
           
                logging.info(f"[{request_id}] [Verify] SUCCESS! Returning decrypted echostr: {decrypted_content}")
                return decrypted_content, 200

            except Exception as e:
                logging.error(f"[{request_id}] Error during GET request decryption/validation: {e}", exc_info=True)
                return "Decryption or validation failed", 500

        elif request.method == 'POST':
            msg_signature = request.args.get('msg_signature')
            timestamp = request.args.get('timestamp')
            nonce = request.args.get('nonce')

            # เพิ่ม Log สำหรับ Request Data และ Args ที่เข้ามา
            raw_xml_data = request.data
            logging.debug(f"[{request_id}] Received raw POST XML message: {raw_xml_data.decode('utf-8')}")
            logging.debug(f"[{request_id}] Received POST request args: {request.args}")


            wecom_crypto = WeComCrypto(WECOM_TOKEN, WECOM_ENCODING_AES_KEY, WECOM_CORP_ID)

            from_user_id = "UNKNOWN_USER"
            try:
                xml_root_from_post = ET.fromstring(raw_xml_data)
                encrypted_text_from_xml = xml_root_from_post.find('Encrypt').text

                logging.debug(f"[{request_id}] Extracted encrypted text from XML: {encrypted_text_from_xml[:50]}...")

                # สำหรับ POST request, การถอดรหัสข้อความจริง
                decrypted_xml_str = wecom_crypto.decrypt_message(encrypted_text_from_xml)

                msg_root = ET.fromstring(decrypted_xml_str)

                # ดึงข้อมูลพื้นฐานที่ทุกประเภทข้อความ
                msg_type = msg_root.find('MsgType').text
                from_user_id = msg_root.find('FromUserName').text
                agent_id = msg_root.find('AgentID').text

                received_text = ''
                msg_id = None

                # แยกการประมวลผลตามประเภทข้อความ
                if msg_type == 'text':
                    received_text = msg_root.find('Content').text
                    msg_id = msg_root.find('MsgId').text
                elif msg_type == 'event':
                    # สำหรับ event messages, Content และ MsgId อาจจะไม่มี
                    # แต่จะมี Event และ EventKey แทน
                    event_type = msg_root.find('Event').text
                    event_key = msg_root.find('EventKey').text if msg_root.find('EventKey') is not None else ''
                    logging.info(f"[{request_id}] Received EVENT: Type={event_type}, Key={event_key}")
                 
                    logging.info(f"[{request_id}] [Idempotency] Message ID '{msg_id}' already processed. Skipping.")
                    return "success", 200 # ตอบกลับทันที


                
                current_time = time.time()
                # ลบข้อความที่หมดอายุออกจาก deque
                while SEEN_MESSAGE_IDS and SEEN_MESSAGE_IDS[0][1] < current_time - SEEN_MESSAGE_TTL_SECONDS:
                    SEEN_MESSAGE_IDS.popleft()

                if msg_id:
                    for seen_id, _ in SEEN_MESSAGE_IDS:
                        if seen_id == msg_id:
                            logging.info(f"[{request_id}] [Idempotency] Message ID '{msg_id}' already processed. Skipping.")
                            return "success", 200 # ตอบกลับทันที

                    # เพิ่ม MsgId นี้เข้าไปใน deque หากยังไม่เคยเห็น
                    SEEN_MESSAGE_IDS.append((msg_id, current_time))


                logging.info(f"[{request_id}] [POST] จาก={from_user_id}, ประเภท={msg_type}, ข้อความ={received_text}")
                logging.debug(f"[{request_id}] Raw received_text: '{received_text}' (Length: {len(received_text)})")

                # เพิ่มคำสั่งช่วยเหลือ (Help Command)
                if received_text.strip().lower() == 'help' or received_text.strip() == '0':
                    logging.info(f"[{request_id}] Processing command 'help' or '0'")
                    reply_text = (
                         "คำสั่งที่รองรับ:\n"
                        "0 หรือ help: แสดงรายการคำสั่งนี้\n"
                        "\n"
                        "1 หรือ 1/YYYY-MM-DD: สรุปการสแกนเข้า-ออกของทั้งแผนก\n"
                        "\n"
                        "2 : สรุปการสแกนเข้า-ออกส่วนตัวประจำวัน\n"
                        "\n"
                        "3 หรือ 3/WorkdayID หรือ 3/WorkdayID/YYYY-MM: สรุปการสแกนเข้า-ออกส่วนตัวประจำเดือน (ถ้าไม่ระบุ WorkdayID จะเป็นของคุณ)\n"
                        "\n"
                        "4 : รายชื่อพนักงานในแผนกของคุณ\n"
                        "\n"
                        "5 : แสดงรายการวันหยุดประจำปีปัจจุบัน" 
                    )
                
                elif received_text.strip() == '5': 
                    logging.info(f"[{request_id}] Processing command '5' (Company Holidays)")
                    try:
                        current_year = datetime.now().year
                        holidays_api_url = f"{COMPANY_HOLIDAYS_API}?year={current_year}"
                        logging.debug(f"[{request_id}] Calling Company Holidays API: {holidays_api_url}")
                        
                        holidays_response = requests.get(holidays_api_url)
                        holidays_response.raise_for_status()
                        holidays_data = holidays_response.json()
                        logging.debug(f"[{request_id}] Company Holidays API response: {holidays_data}")

                        if holidays_data and isinstance(holidays_data, list):
                            if not holidays_data:
                                reply_text = f"ไม่พบข้อมูลวันหยุดประจำปี {current_year}."
                            else:
                                reply_lines = [f"**รายการวันหยุดประจำปี {current_year}:**"]
                                for holiday in holidays_data:
                                    holiday_date = holiday.get('holidayDate', 'N/A')
                                    holiday_desc_th = holiday.get('descTh', 'ไม่ระบุ') 
                                    reply_lines.append(f"- {holiday_date}: {holiday_desc_th}")
                                reply_text = "\n".join(reply_lines)
                        else:
                            reply_text = f"ไม่สามารถดึงข้อมูลวันหยุดประจำปี {current_year} ได้ กรุณาลองใหม่."
                    except requests.exceptions.RequestException as req_e:
                        logging.error(f"[{request_id}] API Request Error in command '5': {req_e}", exc_info=True)
                        reply_text = "ขออภัย เกิดข้อผิดพลาดในการดึงข้อมูลวันหยุดจากระบบ กรุณาลองใหม่"
                    except json.JSONDecodeError as json_e:
                        logging.error(f"[{request_id}] JSON Decode Error from API in command '5': {json_e}", exc_info=True)
                        reply_text = "ขออภัย ข้อมูลวันหยุดจากระบบไม่ถูกต้อง กรุณาลองใหม่"
                    except Exception as e:
                        logging.error(f"[{request_id}] Unexpected error in command '5' processing: {e}", exc_info=True)
                        reply_text = "เกิดข้อผิดพลาดที่ไม่คาดคิดในการประมวลผลคำสั่ง '5' กรุณาลองใหม่อีกครั้ง"

                elif received_text.strip().startswith('1'):
                    logging.info(f"[{request_id}] Processing command '1' (Department Scan Summary)")
                    workday_id = get_workday_id_from_wecom_id(from_user_id, request_id)
                    logging.debug(f"[{request_id}] Workday ID for {from_user_id}: {workday_id}")

                    # --- NEW LOGIC FOR 1/YYYY-MM-DD ---
                    target_date = datetime.now().strftime("%Y-%m-%d") 
                    if received_text.strip().startswith('1/') and len(received_text.strip()) > 2:
                        try:
                            date_str = received_text.strip().split('/')[1]
                           
                            datetime.strptime(date_str, "%Y-%m-%d") 
                            target_date = date_str
                            logging.info(f"[{request_id}] Command '1' with specific date: {target_date}")
                        except (ValueError, IndexError):
                            logging.warning(f"[{request_id}] Invalid date format for command '1/'. Using current date.")
                          
                    # --- END NEW LOGIC ---

                    if workday_id:
                        try:
                            user_dept_code, user_emp_name, user_dept_name = get_employee_dept_info(workday_id, request_id) 

                            if user_dept_code:
                                all_workday_ids_in_dept = get_all_workday_ids_by_dept_code(user_dept_code, request_id)

                                summary_data = get_department_daily_summary(user_dept_code, target_date, request_id) # Use target_date

                                if not summary_data or not isinstance(summary_data, list) or not summary_data[0]:
                                    reply_text = f"ไม่พบข้อมูลการสแกนสำหรับแผนก {user_dept_code} วันที่ {target_date} อาจยังไม่มีข้อมูลในระบบ."
                                else:
                                    summary_info = summary_data[0]

                                    total_employees = summary_info.get('noofPerson')
                                    total_scan = summary_info.get('noofPersonScan')
                                    total_not_scan = summary_info.get('noofPersonNotScan')
                                    dept_name = summary_info.get('deptName', user_dept_code) 

                                    not_scanned_employees_names = []
                                    if total_not_scan and total_not_scan > 0 and all_workday_ids_in_dept:
                                        detail_data = get_scan_details_for_department(target_date, all_workday_ids_in_dept, request_id)

                                        if detail_data and isinstance(detail_data, list):
                                            for entry in detail_data:
                                                if (str(entry.get('workdayId')) in all_workday_ids_in_dept and
                                                    (not entry.get('scanIn') and not entry.get('scanOut'))):
                                                    not_scanned_employees_names.append(entry.get('empName', ''))
                                        logging.debug(f"[{request_id}] Not scanned employees: {not_scanned_employees_names}")

                                    reply_text = (
                                        f"ข้อมูลการสแกนสำหรับแผนก {dept_name} วันที่ {target_date}\n"
                                        f"พนักงานทั้งหมด: {total_employees} คน\n"
                                        f"สแกนแล้ว: {total_scan} คน\n"
                                        f"ยังไม่สแกน: {total_not_scan} คน\n"
                                    )
                                    if not_scanned_employees_names:
                                        reply_text += f"\n**รายชื่อผู้ที่ยังไม่สแกน:**\n- " + "\n- ".join(not_scanned_employees_names)
                                    else:
                                        reply_text += "\nทุกคนในแผนกสแกนเรียบร้อยแล้ว!"
                            else:
                                reply_text = "ไม่พบข้อมูลแผนกของคุณ กรุณาติดต่อ HR หรือผู้ดูแลระบบ."
                        except requests.exceptions.RequestException as req_e:
                            logging.error(f"[{request_id}] API Request Error in command '1': {req_e}", exc_info=True)
                            reply_text = "ขออภัย เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบ กรุณาลองใหม่"
                        except json.JSONDecodeError as json_e:
                            logging.error(f"[{request_id}] JSON Decode Error from API in command '1': {json_e}", exc_info=True)
                            reply_text = "ขออภัย ข้อมูลจากระบบไม่ถูกต้อง กรุณาลองใหม่"
                        except Exception as e:
                            logging.error(f"[{request_id}] Unexpected error in command '1' processing: {e}", exc_info=True)
                            reply_text = "เกิดข้อผิดพลาดที่ไม่คาดคิดในการประมวลผลคำสั่ง '1' กรุณาลองใหม่อีกครั้ง"
                    else:
                        reply_text = "เกิดข้อผิดพลาด กรุณาลองใหม่"

                elif received_text.strip() == '2':
                    logging.info(f"[{request_id}] Processing command '2' (Personal Daily Scan Summary)")
                    workday_id = get_workday_id_from_wecom_id(from_user_id, request_id)
                    if workday_id:
                        try:
                            today_date = datetime.now().strftime("%Y-%m-%d")

                            scan_detail_personal_params = {
                                'scandate': today_date,
                                'workdayIds': [workday_id]
                            }
                            logging.debug(f"[{request_id}] Calling SCAN_DETAIL_API for personal data with params: {scan_detail_personal_params}")

                            personal_detail_response = requests.get(SCAN_DETAIL_API, params=scan_detail_personal_params)
                            personal_detail_response.raise_for_status()
                            personal_detail_data = personal_detail_response.json()
                            logging.debug(f"[{request_id}] SCAN_DETAIL_API response for personal: {personal_detail_data}")

                            if personal_detail_data and isinstance(personal_detail_data, list):
                                user_scan_info = None
                                for entry in personal_detail_data:
                                    if str(entry.get('workdayId')) == workday_id:
                                        user_scan_info = entry
                                        break

                                if user_scan_info:
                                    emp_name = user_scan_info.get('empName', 'คุณ')
                                    scan_in = user_scan_info.get('scanIn', 'ยังไม่สแกน')
                                    scan_out = user_scan_info.get('scanOut', 'ยังไม่สแกน')

                                    reply_text = (
                                        f"ข้อมูลการสแกนของคุณ {emp_name} วันที่ {today_date}\n"
                                        f"สแกนเข้า: {scan_in}\n"
                                        f"สแกนออก: {scan_out}"
                                    )
                                    if scan_in == 'ยังไม่สแกน' or scan_out == 'ยังไม่สแกน':
                                        reply_text += "\nโปรดตรวจสอบสถานะการสแกนของคุณ"
                                else:
                                    reply_text = f"ไม่พบข้อมูลการสแกนของคุณสำหรับวันนี้ ({today_date}) อาจยังไม่มีข้อมูลในระบบ"
                            else:
                                reply_text = f"ไม่สามารถดึงข้อมูลการสแกนส่วนตัวของคุณได้สำหรับวันนี้ ({today_date}) กรุณาลองใหม่."
                        except requests.exceptions.RequestException as req_e:
                            logging.error(f"[{request_id}] API Request Error in command '2': {req_e}", exc_info=True)
                            reply_text = "ขออภัย เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบ กรุณาลองใหม่ในภายหลัง"
                        except json.JSONDecodeError as json_e:
                            logging.error(f"[{request_id}] JSON Decode Error from API in command '2': {json_e}", exc_info=True)
                            reply_text = "ขออภัย ข้อมูลจากระบบไม่ถูกต้อง กรุณาลองใหม่ในภายหลัง"
                        except Exception as e:
                            logging.error(f"[{request_id}] Unexpected error in command '2' processing: {e}", exc_info=True)
                            reply_text = "เกิดข้อผิดพลาดที่ไม่คาดคิดในการประมวลผลคำสั่ง '2' กรุณาลองใหม่อีกครั้ง"
                    else:
                        reply_text = "ไม่สามารถระบุ workdayId ของคุณได้จาก WeCom ID นี้ กรุณาตรวจสอบข้อมูลผู้ใช้ Line ในระบบ."

                elif received_text.strip().startswith('3'):
                    logging.info(f"[{request_id}] Processing command '3' (Personal Monthly Scan Summary)")
                    
                    parts = received_text.strip().split('/')
                    target_workday_id = None
                    target_year = datetime.now().year
                    target_month = datetime.now().month

                    if len(parts) == 2: # Format: 3/WorkdayID
                        try:
                            target_workday_id = parts[1]
                            logging.info(f"[{request_id}] Command '3' with specific workdayId: {target_workday_id}")
                        except IndexError:
                            logging.warning(f"[{request_id}] Invalid format for command '3/'. Using sender's workdayId and current month.")
                            target_workday_id = None
                    elif len(parts) == 3: # Format: 3/WorkdayID/YYYY-MM
                        try:
                            target_workday_id = parts[1]
                            year_month_str = parts[2]
                            year_parts = year_month_str.split('-')
                            if len(year_parts) == 2:
                                target_year = int(year_parts[0])
                                target_month = int(year_parts[1])
                                if not (1 <= target_month <= 12 and 2000 <= target_year <= datetime.now().year + 5): # Basic validation
                                    raise ValueError("Invalid year or month value.")
                                logging.info(f"[{request_id}] Command '3' with specific workdayId '{target_workday_id}' and month '{target_year}-{target_month}'.")
                            else:
                                raise ValueError("Invalid YYYY-MM format.")
                        except (ValueError, IndexError):
                            logging.warning(f"[{request_id}] Invalid format for command '3/WorkdayID/YYYY-MM'. Using sender's workdayId and current month.")
                            target_workday_id = None # Reset if parsing failed to force default
                            target_year = datetime.now().year
                            target_month = datetime.now().month
                    else: # Format: 3 (default to sender's workdayId and current month)
                        logging.info(f"[{request_id}] Command '3' without specific workdayId or month. Using sender's workdayId and current month.")
                         


                    if not target_workday_id:
                        target_workday_id = get_workday_id_from_wecom_id(from_user_id, request_id)
                        logging.debug(f"[{request_id}] Using sender's Workday ID: {target_workday_id}")

                    if target_workday_id:
                        try:
                            scan_summary_personal_params = {
                                'year': target_year,
                                'month': target_month,
                                'workdayIds': target_workday_id
                            }
                            logging.debug(f"[{request_id}] Calling SCAN_SUMMARY_PERSONAL_API with params: {scan_summary_personal_params}")

                            summary_personal_response = requests.get(SCAN_SUMMARY_PERSONAL_API, params=scan_summary_personal_params)
                            summary_personal_response.raise_for_status()
                            summary_personal_data = summary_personal_response.json()
                            logging.debug(f"[{request_id}] SCAN_SUMMARY_PERSONAL_API response: {summary_personal_data}")

                            if summary_personal_data and isinstance(summary_personal_data, list):
                                if not summary_personal_data:
                                    reply_text = f"ไม่พบข้อมูลการสแกนสำหรับเดือน {target_month}/{target_year} ของ Workday ID: {target_workday_id} อาจยังไม่มีข้อมูลในระบบ"
                                else:
                                    emp_name_display = 'คุณ'
                                    emp_code_display = 'N/A'
                                    
                                    # หาชื่อและรหัสพนักงานจากข้อมูลที่มี WorkdayID ตรงกันและมีค่า
                                    for entry in summary_personal_data:
                                        if str(entry.get('workdayId')) == target_workday_id and entry.get('empName'):
                                            emp_name_display = entry.get('empName')
                                            emp_code_display = entry.get('empCode', 'N/A')
                                            break # เจอแล้ว หยุดวนลูป

                                    reply_lines = [
                                        f"**คุณ {emp_name_display}**",
                                        f"**รหัสพนักงาน: {emp_code_display}**",
                                        f"สรุปการสแกนประจำเดือน {target_month}/{target_year}",
                                        "--------------"
                                    ]

                                    for entry in summary_personal_data:
                                        date_work = entry.get('dateWork', 'N/A')
                                        scan_in = entry.get('scanIn') if entry.get('scanIn') else 'ยังไม่สแกน'
                                        scan_out = entry.get('scanOut') if entry.get('scanOut') else 'ยังไม่สแกน'
                                        status = entry.get('status', 'ไม่มีสถานะ')
                                        holiday_desc = entry.get('holidayDescTh', '')

                                        display_date = date_work.split('-')[-1]

                                        if status in ['วันหยุดบริษัท', 'วันหยุดนักขัตฤกษ์', 'ขาดงาน']:
                                            if holiday_desc and status in ['วันหยุดบริษัท', 'วันหยุดนักขัตฤกษ์']:
                                                time_display_part = f"{status} ({holiday_desc})"
                                            else:
                                                time_display_part = status
                                        else:
                                            time_display_part = f"{scan_in} | {scan_out}"

                                        reply_lines.append(
                                            f"{display_date} {time_display_part}"
                                        )

                                    reply_text = "\n".join(reply_lines)

                            else:
                                reply_text = f"ไม่สามารถดึงข้อมูลสรุปการสแกนส่วนตัวรายเดือนของคุณได้สำหรับเดือน {target_month}/{target_year} ของ Workday ID: {target_workday_id} กรุณาลองใหม่."
                        except requests.exceptions.RequestException as req_e:
                            logging.error(f"[{request_id}] API Request Error in command '3': {req_e}", exc_info=True)
                            reply_text = "ขออภัย เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบ กรุณาลองใหม่"
                        except json.JSONDecodeError as json_e:
                            logging.error(f"[{request_id}] JSON Decode Error from API in command '3': {json_e}", exc_info=True)
                            reply_text = "ขออภัย ข้อมูลจากระบบไม่ถูกต้อง กรุณาลองใหม่"
                        except Exception as e:
                            logging.error(f"[{request_id}] Unexpected error in command '3' processing: {e}", exc_info=True)
                            reply_text = "เกิดข้อผิดพลาดที่ไม่คาดคิดในการประมวลผลคำสั่ง '3' กรุณาลองใหม่อีกครั้ง"
                    else:
                        reply_text = "ไม่สามารถระบุ workdayId ของคุณหรือ Workday ID ที่ระบุได้"

                elif received_text.strip() == '4':
                    logging.info(f"[{request_id}] Processing command '4' (List Employees in Department)")
                    workday_id = get_workday_id_from_wecom_id(from_user_id, request_id)
                    if workday_id:
                        try:
                            user_dept_code, user_emp_name, user_dept_name = get_employee_dept_info(workday_id, request_id)
                            if user_dept_code:
                                employees_in_dept = get_employees_by_department(user_dept_code, request_id)
                                if employees_in_dept:
                                    dept_name_display = user_dept_name if user_dept_name else user_dept_code

                                    reply_lines = [f"**รายชื่อในแผนก ({dept_name_display}):({user_dept_code})**"]
                                    
                                    sorted_employees = sorted(employees_in_dept, key=lambda x: x.get('empName', ''))
                                    
                                    for i, emp in enumerate(sorted_employees):
                                        emp_name = emp.get('empName', 'ไม่ระบุชื่อ')
                                        emp_workday_id = emp.get('workdayId', 'ไม่ระบุ ID')
                                        reply_lines.append(f"{i+1}. {emp_name} : {emp_workday_id}")
                                    reply_text = "\n".join(reply_lines)
                                else:
                                    reply_text = f"ไม่พบรายชื่อพนักงานในแผนก {user_dept_code}."
                            else:
                                reply_text = "ไม่พบข้อมูลแผนกของคุณ กรุณาติดต่อ HR หรือผู้ดูแลระบบ."
                        except requests.exceptions.RequestException as req_e:
                            logging.error(f"[{request_id}] API Request Error in command '4': {req_e}", exc_info=True)
                            reply_text = "ขออภัย เกิดข้อผิดพลาดในการดึงข้อมูลจากระบบ กรุณาลองใหม่"
                        except json.JSONDecodeError as json_e:
                            logging.error(f"[{request_id}] JSON Decode Error from API in command '4': {json_e}", exc_info=True)
                            reply_text = "ขออภัย ข้อมูลจากระบบไม่ถูกต้อง กรุณาลองใหม่"
                        except Exception as e:
                            logging.error(f"[{request_id}] Unexpected error in command '4' processing: {e}", exc_info=True)
                            reply_text = "เกิดข้อผิดพลาดที่ไม่คาดคิดในการประมวลผลคำสั่ง '4' กรุณาลองใหม่อีกครั้ง"
                    else:
                        reply_text = "ไม่สามารถระบุ workdayId ของคุณได้จาก WeCom ID นี้"
                else: # Default reply if no command is matched
                    reply_text = "ขออภัย ไม่เข้าใจคำสั่งของคุณ กรุณาลองใหม่ด้วย '1', '2', '3', '4', '0' หรือ 'help' เพื่อดูรายการคำสั่งที่รองรับ"

                logging.debug(f"[{request_id}] Final reply_text prepared: \n---START REPLY---\n{reply_text}\n---END REPLY---")
                send_wecom_message(from_user_id, reply_text, request_id)
                return "success", 200

            except Exception as e:
                logging.error(f"[{request_id}] Error processing POST request: {e}", exc_info=True)
                if from_user_id != "UNKNOWN_USER":
                    send_wecom_message(from_user_id, "เกิดข้อผิดพลาดในการประมวลผลคำขอของคุณ กรุณาลองใหม่อีกครั้ง", request_id)
                return "fail", 500

    except Exception as e:
        logging.error(f"[{request_id}] Unexpected error in webhook: {e}", exc_info=True)
        return "Internal Server Error", 500

if __name__ == '__main__':
    logging.info("Starting Flask application...")
    logging.info(f"Corp ID: {WECOM_CORP_ID}")
    logging.info(f"Agent ID: {WECOM_AGENT_ID}")
    logging.info(f"Token: {WECOM_TOKEN}")
    logging.info(f"EncodingAESKey length: {len(WECOM_ENCODING_AES_KEY)}")

    try:
        wecom_crypto_test = WeComCrypto(WECOM_TOKEN, WECOM_ENCODING_AES_KEY, WECOM_CORP_ID)
        logging.info("WeComCrypto test initialization successful.")
    except Exception as e:
        logging.error(f"WeComCrypto test initialization failed: {e}")
        sys.exit(1)

    app.run(host='0.0.0.0', port=5000,debug=False)


#step to use
# run wecomcallback.py

#-------------------------#
# download cloudflared (public URL)

# in terminal or cmd in path at download cloudflared
#paste "cloudflared.exe tunnel --url http://127.0.0.1:5001 --protocol http2"
#ps.1 file name must be the same as when downloaded.

#Take the link and paste it into wecom web (Receive Messages via API)
#ps.2 everytime to close terminal path at run cloudflared. new run path, you will change new link in wecom web (Receive Messages via API) too