// File: ../types/employee.ts

export type ReportApiRawData = {
  employeeId?: string;
  groupid?: string;
  groupname?: string;
  workdate: string;
  deptcode: string;
  deptname: string;
  deptsbu?: string;
  deptstd?: string | null;
  countscan?: string;
  countnotscan?: string;
  countperson?: string;
  late?: string;
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
  divisionCode: string;
  divisionName: string;
  originalFullDeptcode: string;
};