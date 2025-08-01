import psycopg2
import requests
import json
import time
from datetime import datetime, timedelta, date, time as dt_time_obj
import os
import io
import sys
from dateutil import parser
from collections import defaultdict
import random

# --- 1. กำหนดค่าการเชื่อมต่อ ---
# WeCom API Config
WECOM_CORP_ID = "ww079b6b868ed626cb"
WECOM_AGENT_ID = 1000002
WECOM_AGENT_SECRET = "8FZ5KdIZZDmyr7p3PSBMXwG_X_tyzQN0jSPLrKEQHRE"
# Backend API Endpoints
EMPLOYEE_ACTIVE_API = "http://10.35.10.47:2007/api/LineNotify/EmployeeActive"
LINE_USERS_API = "http://10.35.10.47:2007/api/LineUsers"

# Backend API Endpoint สำหรับดึงข้อมูลการสแกนรายวัน
DAILY_SCANS_API = "http://10.35.10.47:2007/api/LineNotify/ScanSummary"



# Polling Interval (ในหน่วยวินาที)
POLL_INTERVAL_SECONDS = 30 # ตรวจสอบทุก 30 วินาที


# File Paths for State Management
STATE_DIR = "state"
LAST_POLL_STATE_FILE = os.path.join(STATE_DIR, "last_polled_time.json")
NOTIFIED_STATUS_FILE = os.path.join(STATE_DIR, "notified_status.json")
TOTAL_SCAN_IN_STATUS_FILE = os.path.join(STATE_DIR, "total_scan_in_status.json")

# สร้าง directory สำหรับเก็บ state ถ้ายังไม่มี
os.makedirs(STATE_DIR, exist_ok=True)

# สำหรับการทดสอบวันที่เฉพาะ (ตั้งค่าเป็น None เพื่อใช้ datetime.now() ในการทำงานปกติ)
TEST_DATE = None 

# --- 2. ฟังก์ชันช่วยจัดการวันที่และเวลา ---
def safe_strftime(dt_obj, fmt):
    """แปลง datetime object เป็น string ตาม format ที่กำหนดอย่างปลอดภัย"""
    if dt_obj is None:
        return ""
    try:
        if isinstance(dt_obj, datetime) or isinstance(dt_obj, date):
            return dt_obj.strftime(fmt)
        return str(dt_obj)
    except Exception as e:
        print(f"Error formatting datetime object: {dt_obj} with format {fmt} - {e}")
        return str(dt_obj)

# --- 3. ฟังก์ชันสำหรับจัดการ WeCom API ---
def get_access_token():
    """ดึง WeCom access_token"""
    url = f"https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid={WECOM_CORP_ID}&corpsecret={WECOM_AGENT_SECRET}"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
        data = response.json()
        if data.get("errcode") == 0:
            return data.get("access_token")
        else:
            print(f"Error getting WeCom access token: {data.get('errmsg')}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Network error getting WeCom access token: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from access token response: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred in get_access_token: {e}")
        return None

def send_wecom_message(access_token, user_id, message_content):
    """ส่งข้อความไปยังผู้ใช้ WeCom"""
    if not access_token:
        print("Access Token is missing. Cannot send message.")
        return False
    if not user_id:
        print("User ID is missing. Cannot send message.")
        return False
    
    url = f"https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token={access_token}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "touser": user_id,
        "msgtype": "text",
        "agentid": WECOM_AGENT_ID,
        "text": {
            "content": message_content
        },
        "safe": 0
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        response.raise_for_status()
        data = response.json()
        if data.get("errcode") == 0:
            # print(f"Message sent successfully to {user_id}")
            return True
        else:
            print(f"Error sending WeCom message to {user_id}: {data.get('errmsg')}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"Network error sending WeCom message to {user_id}: {e}")
        return False
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from WeCom message response: {e}")
        return False
    except Exception as e:
        print(f"An unexpected error occurred in send_wecom_message: {e}")
        return False

# --- 4. ฟังก์ชันสำหรับจัดการสถานะ (State Management) ---
def load_last_polled_time():
    """โหลดเวลาที่ Poll ล่าสุดจากไฟล์"""
    if os.path.exists(LAST_POLL_STATE_FILE):
        with open(LAST_POLL_STATE_FILE, 'r') as f:
            try:
                data = json.load(f)
                return datetime.fromisoformat(data['last_polled_dt'])
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                print(f"Error loading last_polled_dt: {e}. Resetting to current time.")
    # กำหนดค่าเริ่มต้นให้เป็น 6 ชั่วโมงที่แล้ว เพื่อให้แน่ใจว่าได้ข้อมูลสแกนของวันปัจจุบัน
    return datetime.now() - timedelta(hours=6)

def save_last_polled_time(dt):
    """บันทึกเวลาที่ Poll ล่าสุดลงไฟล์"""
    os.makedirs(os.path.dirname(LAST_POLL_STATE_FILE), exist_ok=True)
    with open(LAST_POLL_STATE_FILE, 'w') as f:
        json.dump({'last_polled_dt': dt.isoformat()}, f)

def load_notified_status():
    """โหลดสถานะการแจ้งเตือนของแต่ละบุคคลจากไฟล์"""
    if os.path.exists(NOTIFIED_STATUS_FILE):
        with open(NOTIFIED_STATUS_FILE, 'r') as f:
            try:
                data = json.load(f)
                # Convert string times back to datetime objects
                for person_code, status in data.items():
                    if status['first_in_time']:
                        status['first_in_time'] = datetime.fromisoformat(status['first_in_time'])
                    if status['last_out_time']:
                        status['last_out_time'] = datetime.fromisoformat(status['last_out_time'])
                return data
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                print(f"Error loading notified_status: {e}. Resetting status.")
    return {}

def save_notified_status(status):
    """บันทึกสถานะการแจ้งเตือนของแต่ละบุคคลลงไฟล์"""
    os.makedirs(os.path.dirname(NOTIFIED_STATUS_FILE), exist_ok=True)
    with open(NOTIFIED_STATUS_FILE, 'w') as f:
        # Convert datetime objects to string before saving
        serializable_status = {}
        for person_code, s in status.items():
            serializable_status[person_code] = {
                'first_in_time': s['first_in_time'].isoformat() if s['first_in_time'] else None,
                'last_out_time': s['last_out_time'].isoformat() if s['last_out_time'] else None
            }
        json.dump(serializable_status, f, indent=4)

def load_total_scan_in_status():
    """โหลดสถานะการแจ้งเตือนยอดรวมจากไฟล์"""
    if os.path.exists(TOTAL_SCAN_IN_STATUS_FILE):
        with open(TOTAL_SCAN_IN_STATUS_FILE, 'r') as f:
            try:
                data = json.load(f)
                return {
                    'total_count': data.get('total_count', 0),
                    'last_notified_time': datetime.fromisoformat(data['last_notified_time']) if data.get('last_notified_time') else None,
                    'date': date.fromisoformat(data['date']) if data.get('date') else date.min
                }
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                print(f"Error loading total_scan_in_status: {e}. Resetting status.")
    return {'total_count': 0, 'last_notified_time': None, 'date': date.min}

def save_total_scan_in_status(total_count, last_notified_time, current_date):
    """บันทึกสถานะการแจ้งเตือนยอดรวมลงไฟล์"""
    os.makedirs(os.path.dirname(TOTAL_SCAN_IN_STATUS_FILE), exist_ok=True)
    with open(TOTAL_SCAN_IN_STATUS_FILE, 'w') as f:
        json.dump({
            'total_count': total_count,
            'last_notified_time': last_notified_time.isoformat() if last_notified_time else None,
            'date': current_date.isoformat()
        }, f, indent=4)

# --- 5. ฟังก์ชันสำหรับดึงข้อมูลจาก Backend APIs (ปรับปรุงแก้ไขตามโครงสร้างจริง) ---
def fetch_employee_data_from_apis():
    """
    ดึงข้อมูลพนักงานจาก EmployeeActive และ LineUsers APIs แล้วรวมเข้าด้วยกัน
    เพื่อให้มีข้อมูลครบถ้วนสำหรับแต่ละ Workday ID รวมถึง empCode, weComId, full_name
    """
    combined_employee_data = {} # Key จะเป็น workdayId

    try:
        # 1. ดึงข้อมูลพนักงาน Active ทั้งหมดก่อน (มี workdayId)
        print(f"[DEBUG] Fetching data from {EMPLOYEE_ACTIVE_API}")
        response_active = requests.get(EMPLOYEE_ACTIVE_API, timeout=10)
        response_active.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        active_employees = response_active.json()
        
        if not isinstance(active_employees, list):
             print(f"[ERROR] EmployeeActive API did not return a list. Response: {active_employees}")
             active_employees = []

        # สร้าง Dictionary ชั่วคราวเพื่อใช้ empCode ในการค้นหา (เพื่อเชื่อมกับ LineUsers)
        # และใช้ workdayId เป็น key หลักใน combined_employee_data
        empcode_to_workdayid_map = {} 
        for emp in active_employees:
            workday_id = str(emp.get('workdayId')) # ดึง workdayId โดยตรง
            emp_code = str(emp.get('empCode')) # ดึง empCode ด้วย
            emp_name = emp.get('empName') # ดึง empName ด้วย

            if workday_id and emp_code: # workdayId และ empCode ต้องไม่ว่างเปล่า
                combined_employee_data[workday_id] = {
                    'emp_code': emp_code,
                    'full_name': emp_name,
                    'dept_code': emp.get('deptCode'), #
                    'dept_name': emp.get('deptName'), #
                    'wecom_user_id': None, # ตั้งต้นเป็น None ไว้ก่อน
                }
                empcode_to_workdayid_map[emp_code] = workday_id # เก็บ map สำหรับการเชื่อมโยง
        
        print(f"[DEBUG] Fetched {len(combined_employee_data)} active employees with Workday IDs.")

        # 2. ดึงข้อมูล LineUsers เพื่อเพิ่ม weComId เข้าไปใน combined_employee_data
        print(f"[DEBUG] Fetching data from {LINE_USERS_API}")
        response_users = requests.get(LINE_USERS_API, timeout=10)
        response_users.raise_for_status()
        line_users = response_users.json()

        if not isinstance(line_users, list):
            print(f"[ERROR] LineUsers API did not return a list. Response: {line_users}")
            line_users = []

        for user in line_users:
            employee_code_from_line = str(user.get('employeeCode')) # employeeCode จาก LineUsers API
            wecom_id = user.get('weComId')
            
            # ใช้ empcode_to_workdayid_map เพื่อหา workdayId ที่ตรงกัน
            if employee_code_from_line in empcode_to_workdayid_map:
                corresponding_workday_id = empcode_to_workdayid_map[employee_code_from_line]
                if corresponding_workday_id in combined_employee_data and wecom_id and wecom_id.strip() != "":
                    combined_employee_data[corresponding_workday_id]['wecom_user_id'] = wecom_id
        
        # นับจำนวนพนักงานที่มี WeCom ID
        wecom_enabled_count = sum(1 for emp in combined_employee_data.values() if emp['wecom_user_id'])
        print(f"[DEBUG] Found {wecom_enabled_count} employees with WeCom IDs after merging with LineUsers.")

    except requests.exceptions.RequestException as e:
        print(f"Network or API error fetching employee data: {e}")
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from employee data API response: {e}")
    except Exception as e:
        print(f"An unexpected error occurred while fetching employee data: {e}")
    
    print(f"[DEBUG] Final combined data for {len(combined_employee_data)} employees (keyed by Workday ID).")
    return combined_employee_data

# **ฟังก์ชันนี้ถูกเปลี่ยนจากการ Mock ไปเป็นการเรียก API จริง**
def fetch_scans_from_api(target_date, combined_employee_data):
    """
    ดึงข้อมูลการสแกนเข้าและออกสำหรับวันที่ที่ระบุจาก Backend API จริง (ScanSummary)
    ใช้ combined_employee_data ที่ตอนนี้มี workdayId เป็น key หลัก และข้อมูล weCom_user_id ภายใน
    """
    if not isinstance(target_date, date):
        print(f"[ERROR] Invalid target_date type: {type(target_date)}. Expected date object.", flush=True)
        return []

    current_year = target_date.year
    current_month = target_date.month
    
    # *** นี่คือส่วนที่สำคัญ: ดึง workdayIds จาก keys ของ combined_employee_data ที่ตอนนี้เป็น Workday IDs จริงๆ ***
    # เราจะส่งเฉพาะ workdayId ของพนักงานที่มี wecom_user_id ให้ ScanSummary API เพื่อลดปริมาณข้อมูลที่ไม่จำเป็น
    all_workday_ids_with_wecom = [
        wd_id for wd_id, emp_info in combined_employee_data.items()
        if emp_info.get('wecom_user_id')
    ]
    
    if not all_workday_ids_with_wecom:
        print("[WARNING] No Workday IDs with associated WeCom IDs found to query scans for. Returning empty list.", flush=True)
        return []

    # จำกัดจำนวน workdayIds ใน URL เพื่อหลีกเลี่ยง URL ที่ยาวเกินไป (ถ้ามีพนักงานเยอะมาก)
    # หาก API มีข้อจำกัด หรือมีพนักงานเป็นพันคน อาจต้องแบ่งการเรียก API
    workday_ids_params = "&".join([f"workdayIds={wid}" for wid in all_workday_ids_with_wecom])
    
    # สร้าง URL สำหรับเรียก API ScanSummary
    url = f"{DAILY_SCANS_API}?year={current_year}&month={current_month}&{workday_ids_params}"
    
    print(f"[DEBUG] Fetching daily scan data from {url}", flush=True)
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        scan_summary_data = response.json()

        if not isinstance(scan_summary_data, list):
            print(f"[ERROR] ScanSummary API did not return a list. Response: {scan_summary_data}", flush=True)
            return []

        processed_scans = []
        # เนื่องจาก Response Structure ไม่มี 'dailySummaries' array ภายนอก
        # แต่เป็น list ของ objects ที่แต่ละ object คือข้อมูลหนึ่งวัน (หรือหนึ่งสแกน)
        # เราจะประมวลผลแต่ละ item ใน scan_summary_data โดยตรง
        for summary_item in scan_summary_data:
            # ใช้ key names ตาม Response ที่คุณให้มา
            person_workday_id_from_scan_api = str(summary_item.get('workdayId')) 
            scan_date_str = summary_item.get('dateWork') 
            first_scan_time_str = summary_item.get('scanIn')  
            last_scan_time_str = summary_item.get('scanOut')  
            
            # ดึงข้อมูล WeCom ID, full_name, และ empCode จาก combined_employee_data
            # โดยใช้ workdayId ที่ได้จาก ScanSummary API เพื่อให้มั่นใจว่าข้อมูลตรงกัน
            emp_info = combined_employee_data.get(person_workday_id_from_scan_api, {})
            wecom_user_id = emp_info.get('wecom_user_id')
            full_name = emp_info.get('full_name', 'Unknown')
            emp_code = emp_info.get('emp_code', 'N/A') 
            
            # กรองเฉพาะพนักงานที่เรามี wecom_user_id และต้องการส่งข้อความ
            if not wecom_user_id:
                continue

            scan_date = None
            if scan_date_str:
                try:
                    scan_date = datetime.strptime(scan_date_str, '%Y-%m-%d').date()
                except ValueError:
                    print(f"[ERROR] Invalid dateWork format for Workday ID {person_workday_id_from_scan_api}: {scan_date_str}. Skipping.", flush=True)
                    continue

            # ตรวจสอบว่าเป็นข้อมูลของวันที่ต้องการ (target_date) หรือไม่
            if scan_date and scan_date == target_date:
                first_scan_dt = None
                if first_scan_time_str:
                    try:
                        time_obj = datetime.strptime(first_scan_time_str, '%H:%M:%S').time()
                        first_scan_dt = datetime.combine(scan_date, time_obj)
                    except ValueError:
                        # ลอง parse ด้วย dateutil.parser.isoparse เผื่อเป็น ISO format
                        try:
                            first_scan_dt = parser.isoparse(first_scan_time_str)
                            if first_scan_dt.date() != scan_date:
                                 first_scan_dt = datetime.combine(scan_date, first_scan_dt.time())
                        except ValueError:
                            print(f"[ERROR] Could not parse scanIn time for Workday ID {person_workday_id_from_scan_api} on {scan_date}: {first_scan_time_str}", flush=True)
                        
                last_scan_dt = None
                if last_scan_time_str: # scanOut อาจเป็น null
                    try:
                        time_obj = datetime.strptime(last_scan_time_str, '%H:%M:%S').time()
                        last_scan_dt = datetime.combine(scan_date, time_obj)
                    except ValueError:
                        # ลอง parse ด้วย dateutil.parser.isoparse เผื่อเป็น ISO format
                        try:
                            last_scan_dt = parser.isoparse(last_scan_time_str)
                            if last_scan_dt.date() != scan_date:
                                last_scan_dt = datetime.combine(scan_date, last_scan_dt.time())
                        except ValueError:
                            print(f"[ERROR] Could not parse scanOut time for Workday ID {person_workday_id_from_scan_api} on {scan_date}: {last_scan_time_str}", flush=True)

                # เพิ่มข้อมูลเข้า processed_scans เฉพาะวันที่ตรง
                # Note: หากมี scanIn/scanOut เป็น null แต่สถานะเป็น "มาทำงาน" อาจจะยังต้องการรวมด้วย
                # แต่หลักการแจ้งเตือนเราจะดูที่ firstscantime และ lastscantime เป็นหลัก
                if first_scan_dt or last_scan_dt: # เพิ่มเฉพาะรายการที่มีข้อมูลสแกนจริงๆ
                    processed_scans.append({
                        "person_code": person_workday_id_from_scan_api, # ตอนนี้ person_code คือ workdayId
                        "full_name": full_name,
                        "workdate": scan_date,
                        "firstscantime": first_scan_dt,
                        "lastscantime": last_scan_dt,
                        "wecom_user_id": wecom_user_id,
                        "emp_code": emp_code 
                    })
        
        print(f"[DEBUG] Fetched and processed {len(processed_scans)} daily scan records from ScanSummary API for {target_date}.", flush=True)
        # แปลงให้เป็น tuple เหมือนผลลัพธ์จาก cursor.fetchall() ของโค้ดเดิม
        return [
            (s['person_code'], s['full_name'], s['workdate'], s['firstscantime'], s['lastscantime'], s['wecom_user_id'], s['emp_code'])
            for s in processed_scans
        ]

    except requests.exceptions.RequestException as e:
        print(f"Network or API error fetching daily scan data from {url}: {e}", flush=True)
        return []
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from daily scan API response ({url}): {e}", flush=True)
        return []
    except Exception as e:
        print(f"An unexpected error occurred while fetching daily scan data from {url}: {e}", flush=True)
        return []

# **ฟังก์ชันนี้ถูกเปลี่ยนจากการ Mock ไปเป็นการคำนวณจากข้อมูลใน combined_employee_data**
def fetch_total_scan_in_api(current_date, combined_employee_data):
    """
    ในสถานการณ์จริง คุณอาจจะมี API สำหรับยอดรวมการสแกนเข้าโดยเฉพาะ
    แต่เพื่อความต่อเนื่องของโค้ด เราจะใช้การนับจำนวนพนักงานที่มี wecom_user_id
    """
    print(f"[DEBUG] Calculating total scan-in count internally from active employees with WeCom IDs.", flush=True)
    # นับจำนวนพนักงานที่มี wecom_user_id ซึ่งถือว่าเป็นพนักงานที่ "active และมีช่องทางรับแจ้งเตือน"
    return sum(1 for emp_info in combined_employee_data.values() if emp_info["wecom_user_id"])


# --- 6. ตรรกะหลักของการ Polling และการแจ้งเตือน ---
def poll_and_notify():
    print("[DEBUG] Entered poll_and_notify()", flush=True)
    last_polled_dt = load_last_polled_time()
    print(f"[DEBUG] Loaded last_polled_dt: {last_polled_dt}", flush=True)
    notified_status = load_notified_status()
    print(f"[DEBUG] Loaded notified_status: {len(notified_status)} entries", flush=True)
    total_scan_in_status = load_total_scan_in_status()
    print(f"[DEBUG] Loaded total_scan_in_status: {total_scan_in_status}", flush=True)

    wecom_access_token = None
    token_expiry_time = datetime.now() # Initialize token expiry to force a refresh on first run
    
    print("--- เริ่มการ Poll ข้อมูลจาก API ---", flush=True)
    print(f"Attempting to load state from: {LAST_POLL_STATE_FILE}", flush=True)
    print(f"Starting polling from last processed time: {last_polled_dt} ", flush=True)

    while True:
        try:
            print(f"\n--- Polling cycle started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---", flush=True)
            # Refresh WeCom Access Token if expired or close to expiry
            if datetime.now() >= token_expiry_time - timedelta(minutes=5):
                print("Refreshing WeCom access token...", flush=True)
                wecom_access_token = get_access_token()
                if wecom_access_token:
                    token_expiry_time = datetime.now() + timedelta(seconds=7200) # Token usually lasts 7200 seconds
                    print("WeCom access token refreshed.", flush=True)
                else:
                    print("Failed to get WeCom access token. Retrying in next cycle...", flush=True)
                    time.sleep(POLL_INTERVAL_SECONDS)
                    continue # Skip current polling cycle if token acquisition failed

            # ดึงข้อมูลพนักงานและ WeCom ID จาก API (ตอนนี้รวมการดึง mapping ด้วย)
            combined_employee_data = fetch_employee_data_from_apis()
            if not combined_employee_data:
                print("No employee data (including Workday ID mapping) fetched. Skipping polling cycle.", flush=True)
                time.sleep(POLL_INTERVAL_SECONDS)
                continue

            # --- Individual Scan Notifications ---
            # ใช้ datetime.now().date() เสมอ หาก TEST_DATE ไม่ได้ถูกกำหนด
            # เนื่องจากคุณบอกว่าต้องการข้อมูลของ "วันที่ปัจจุบัน"
            current_date_for_scan = TEST_DATE if TEST_DATE else datetime.now().date()
            current_time_for_poll = TEST_DATE if TEST_DATE else datetime.now() # ยังคงใช้ datetime.now() สำหรับเวลาที่ใช้ในการเปรียบเทียบ state

            print(f"[DEBUG] Running fetch_scans_from_api for date: {current_date_for_scan}", flush=True)
            # ส่ง combined_employee_data ที่ตอนนี้มี workdayId เป็น key หลักไปให้
            new_scans = fetch_scans_from_api(current_date_for_scan, combined_employee_data)
            print(f"[DEBUG] Scan API returned {len(new_scans)} rows for {current_date_for_scan}.", flush=True)

            today_start_of_day = datetime.combine(current_date_for_scan, dt_time_obj.min)
            max_current_scan_time = max(last_polled_dt, today_start_of_day)


            if new_scans:
                print(f"Found {len(new_scans)} new or updated scan records.")
                # ใช้ defaultdict เพื่อรวมข้อมูลสแกนของบุคคลเดียวกันในวันเดียวกัน
                # (กรณีที่ API อาจคืนค่าหลายรายการสำหรับคนเดียวกันในวันเดียวกัน และเราต้องการ first/last)
                scans_by_person_date = defaultdict(lambda: {
                    'full_name': '', 
                    'wecom_user_id': '', 
                    'first_in_time': datetime.max, # เริ่มต้นด้วยค่าที่มากที่สุด
                    'last_out_time': datetime.min,  # เริ่มต้นด้วยค่าที่น้อยที่สุด
                    'workdate': None,
                    'emp_code': ''
                })
                
                for row in new_scans:
                    # เพิ่ม emp_code ในการ unpack tuple
                    person_code, full_name, workdate, firstscantime, lastscantime, wecom_user_id, emp_code = row
                    
                    if not workdate:
                        continue
                    
                    workdate_key = workdate if isinstance(workdate, date) else workdate.date()
                    key = (person_code, workdate_key)
                    
                    scans_by_person_date[key]['full_name'] = full_name
                    scans_by_person_date[key]['wecom_user_id'] = wecom_user_id
                    scans_by_person_date[key]['workdate'] = workdate_key
                    scans_by_person_date[key]['emp_code'] = emp_code 
                    
                    # ถ้ามีเวลาสแกนเข้า และเป็นเวลาที่เร็วกว่าที่เคยเจอ ให้ update
                    if firstscantime and firstscantime < scans_by_person_date[key]['first_in_time']:
                        scans_by_person_date[key]['first_in_time'] = firstscantime
                    
                    # ถ้ามีเวลาสแกนออก และเป็นเวลาที่ช้ากว่าที่เคยเจอ ให้ update
                    if lastscantime and lastscantime > scans_by_person_date[key]['last_out_time']:
                        scans_by_person_date[key]['last_out_time'] = lastscantime
                    
                    # อัปเดต max_current_scan_time เพื่อใช้ในการบันทึก last_polled_dt
                    if firstscantime and firstscantime > max_current_scan_time:
                        max_current_scan_time = firstscantime
                    if lastscantime and lastscantime > max_current_scan_time:
                        max_current_scan_time = lastscantime

                for (person_code, workdate_key), data in scans_by_person_date.items():
                    # เรากรองข้อมูลที่ fetch_scans_from_api มาแล้วว่าต้องเป็น current_date_for_scan
                    # แต่อันนี้เป็นการยืนยันอีกครั้ง
                    if workdate_key != current_date_for_scan:
                        continue

                    user_status = notified_status.get(person_code, {'first_in_time': None, 'last_out_time': None})
                    message_parts = []
                    
                    # ตรวจสอบการแจ้งเตือน "เข้างาน"
                    # เงื่อนไข: มีเวลาสแกนเข้า และ (ยังไม่เคยแจ้ง หรือ เวลาที่ได้มาเร็วกว่าที่เคยแจ้ง หรือ เวลาที่ได้มาใหม่กว่า last_polled_dt)
                    if data['first_in_time'] != datetime.max and \
                       (user_status['first_in_time'] is None or \
                        data['first_in_time'] < user_status['first_in_time'] or \
                        data['first_in_time'] > last_polled_dt): # ตรวจสอบว่ามีการเปลี่ยนแปลงที่ใหม่กว่าการ poll ครั้งล่าสุด
                        message_parts.append(f"🕖 In: {safe_strftime(data['first_in_time'], '%H:%M:%S')} ({safe_strftime(data['workdate'], '%d/%m/%Y')})")
                        user_status['first_in_time'] = data['first_in_time']
                        
                    # ตรวจสอบการแจ้งเตือน "เลิกงาน"
                    # เงื่อนไข: มีเวลาสแกนออก และ (ยังไม่เคยแจ้ง หรือ เวลาที่ได้มาใหม่กว่าที่เคยแจ้ง หรือ เวลาที่ได้มาใหม่กว่า last_polled_dt)
                    if data['last_out_time'] != datetime.min and \
                       (user_status['last_out_time'] is None or \
                        data['last_out_time'] > user_status['last_out_time'] or \
                        data['last_out_time'] > last_polled_dt): # ตรวจสอบว่ามีการเปลี่ยนแปลงที่ใหม่กว่าการ poll ครั้งล่าสุด
                        message_parts.append(f"🕓 Out: {safe_strftime(data['last_out_time'], '%H:%M:%S')} ({safe_strftime(data['workdate'], '%d/%m/%Y')})")
                        user_status['last_out_time'] = data['last_out_time']
                    
                    if message_parts:
                        full_message = f"***New Scan Notification***\nName: {data['full_name']}\nEmployee Code: {data['emp_code']}\n" + "\n".join(message_parts)
                        if data['wecom_user_id']:
                            print(f"[DEBUG] About to send to user_id: {data['wecom_user_id']} (Workday ID: {person_code})")
                            send_wecom_message(wecom_access_token, data['wecom_user_id'], full_message)
                        else:
                            print(f"Warning: No WeCom User ID for {data['full_name']} (Workday ID: {person_code}). Message not sent.")
                        notified_status[person_code] = user_status
                        save_notified_status(notified_status)
            
            # อัปเดต last_polled_dt หลังจากประมวลผลการสแกนทั้งหมด
            # เพื่อให้รอบถัดไปเริ่มตรวจจากเวลาล่าสุดที่มีข้อมูลการสแกนจริงๆ
            # ถ้าไม่มี new_scans เลยในรอบนี้ ก็ยังคงอัปเดต last_polled_dt เป็นเวลาปัจจุบัน
            save_last_polled_time(max_current_scan_time if new_scans else datetime.now())
            
            current_date = TEST_DATE if TEST_DATE else datetime.now().date()
            
            if total_scan_in_status['date'] != current_date:
                print(f"New day detected. Resetting total scan-in status for {current_date}.")
                total_scan_in_status = {'total_count': 0, 'last_notified_time': None, 'date': current_date}
                save_total_scan_in_status(total_scan_in_status['total_count'], total_scan_in_status['last_notified_time'], total_scan_in_status['date'])
            
            current_total_scan_in = fetch_total_scan_in_api(current_date, combined_employee_data)
            print(f"Current total scan-in for {current_date}: {current_total_scan_in} people.")
            
        except requests.exceptions.RequestException as e:
            print(f"ข้อผิดพลาด WeCom API หรือเครือข่าย: {e}")
        except Exception as e:
            print(f"เกิดข้อผิดพลาดที่ไม่คาดคิด: {e}")
        finally:
            pass
        
        print(f"รอ {POLL_INTERVAL_SECONDS} วินาทีก่อนการ Poll ครั้งถัดไป...")
        time.sleep(POLL_INTERVAL_SECONDS)


# --- 7. ฟังก์ชันส่งข้อความทดสอบ ---
def send_test_message_to_wecom(test_date=None):
    print("--- โหมดส่งข้อความทดสอบ ---")
    global TEST_DATE
    if test_date:
        TEST_DATE = test_date
        print(f"[DEBUG] TEST_DATE set to {TEST_DATE}")
    else:
        TEST_DATE = datetime.now().date()
        print(f"[DEBUG] TEST_DATE defaulted to current date: {TEST_DATE}")

    access_token = get_access_token()
    if not access_token:
        print("ไม่สามารถรับ Access Token ได้ ไม่สามารถส่งข้อความทดสอบได้")
        return
    
    # ดึงข้อมูลพนักงานจาก API (ตอนนี้มี workdayId เป็น key หลัก)
    combined_employee_data = fetch_employee_data_from_apis()
    if not combined_employee_data:
        print("No employee data fetched for test message. Cannot send.")
        return

    try:
        print(f"[DEBUG] Fetching scan data for test date {TEST_DATE}")
        scans_for_test = fetch_scans_from_api(TEST_DATE, combined_employee_data)
        
        print(f"[DEBUG] Found {len(scans_for_test)} records for {TEST_DATE}")
        sent_count = 0
        for row in scans_for_test: # unpack tuple ที่ตอนนี้มี 7 ค่า
            person_code, full_name, workdate, firstscantime, lastscantime, wecom_user_id, emp_code = row
            
            if not wecom_user_id:
                print(f"Skipping test message for {full_name} (Workday ID: {person_code}) - No WeCom ID.")
                continue
            
            if workdate != TEST_DATE:
                continue

            in_time = safe_strftime(firstscantime, '%H:%M:%S') if firstscantime else "-"
            out_time = safe_strftime(lastscantime, '%H:%M:%S') if lastscantime else "-"
            # เพิ่ม Workday ID และ Employee Code ในข้อความทดสอบ
            message = f"[TEST] Scan summary for {TEST_DATE.strftime('%d/%m/%Y')}\nName: {full_name}\nEmployee Code: {emp_code}\n🕖 In: {in_time}\n🕓 Out: {out_time}"
            print(f"[DEBUG] Sending test message to {wecom_user_id} (Workday ID: {person_code})")
            send_wecom_message(access_token, wecom_user_id, message)
            sent_count += 1
        print(f"[DEBUG] Sent {sent_count} test messages for {TEST_DATE}")
    except Exception as e:
        print(f"[ERROR] Test mode API/data error: {e}")
    finally:
        pass

# --- 8. การทำงานหลักของโปรแกรม (Main Execution Block) ---
def parse_date_arg(date_str):
    """Parse date string argument into a date object."""
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        raise argparse.ArgumentTypeError("Invalid date format. Please use YYYY-MM-DD.")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Scan time notification script.")
    parser.add_argument('--test-mode', action='store_true', help='Run in test mode (send test message and exit).')
    parser.add_argument('--test-date', type=parse_date_arg, help='Specify a test date for --test-mode in YYYY-MM-DD format.')
    
    args = parser.parse_args()

    if args.test_mode:
        print("Running in test mode...")
        send_test_message_to_wecom(args.test_date)
    else:
        print("Starting polling mode...")
        poll_and_notify()


############ --------run mode----------#############

## python wecomsend.py

############ --------testmode----------#############

##  python wecomsend.py --test-mode --test-date 2025-07-25(เปลี่ยนเป็นวันที่ต้องการทดสอบ)



