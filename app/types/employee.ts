export type ReportApiRawData = {
  employeeId?: string;
  groupid?: string;
  groupname?: string;
  workdate: string; 
  deptcode: string; 
  deptname: string; 
  deptsbu?: string;
  deptstd?: string | null; 
  
  // *** ฟิลด์เหล่านี้คือส่วนที่ API "ควร" จะส่งมาด้วยเพื่อให้แสดงผลได้ถูกต้อง ***
  countscan?: string;      
  countnotscan?: string;  
  countperson?: string;    
  late?: string;           
  // *** ฟิลด์เพิ่มเติมที่พบในข้อมูลตัวอย่างที่คุณให้มา (API ควรจะส่งมา) ***
  deptcodelevel1?: string; 
  deptcodelevel2?: string; 
  deptcodelevel3?: string; 
  deptcodelevel4?: string; 
  parentcode?: string | null; 
};

export type Employee = {
  employeeId: string;
  groupid: string;
  groupname: string;
  workdate: string;
  
  
  deptcode: string; 

  deptname: string; 
  
  deptsbu: string;
  deptstd: string | null; 

  countscan: number;
  countnotscan: number;
  countperson: number;
  late: number;

  factoryCode: string; 
  factoryName: string; 
  mainDepartmentCode: string; 
  mainDepartmentName: string; 
  subDepartmentCode: string; 
  subDepartmentName: string; 
  originalFullDeptcode: string; 
};