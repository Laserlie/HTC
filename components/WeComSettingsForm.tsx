'use client';

import axios from 'axios';
import { useEffect, useState, useMemo, useCallback } from 'react';
import Spinner from './ui/Spinner';
// --- Interfaces สำหรับโครงสร้างข้อมูล ---

interface LineUser {
    id: number;
    userId: string;
    employeeCode: string;
    displayName: string;
    lastMessage: string;
    updatedAt: string;
    workdayId: string;
    deptlist: string;
    language: string;
    createAt: string;
    weComId: string | null;
}

interface Employee {
    id: string;
    name: string;
    deptCode: string;
    deptName: string;
    workdayId: string;
    wecom_id?: string;
    backendLineUserId?: number;
}

interface Department {
    id: string;
    name: string;
    employees: Employee[];
}

// --- Component หลัก: WeComSettingsForm ---
export default function WeComSettingsForm() {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [wecomIdMap, setWecomIdMap] = useState<Map<string, { weComId: string; backendId?: number; workdayId?: string; originalLineUser?: LineUser }>>(new Map());
    const [originalWecomIdMap, setOriginalWecomIdMap] = useState<Map<string, { weComId: string; backendId?: number; workdayId?: string; originalLineUser?: LineUser }>>(new Map());
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<{ deptId: string; deptName: string; employeeName: string; employeeId: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');

    const EMPLOYEE_ACTIVE_API_PROXY = "/api/wecom/employeeactive";
    const LINE_USERS_API_PROXY = "/api/wecom/lineuser";

    // สำหรับ Debugging Frontend State (สามารถลบออกได้เมื่อใช้งานจริง)
    useEffect(() => {
        console.log('--- Frontend State Update ---');
        console.log('departments:', departments);
        console.log('wecomIdMap:', Object.fromEntries(
            Array.from(wecomIdMap.entries()).map(([key, value]) => [key, { ...value, originalLineUser: value.originalLineUser ? '(LineUser Object)' : 'N/A' }])
        ));
        console.log('selectedDepartmentId:', selectedDepartmentId);
        console.log('loading:', loading);
        console.log('error:', error);
        console.log('success:', success);
        console.log('-----------------------------');
    }, [departments, wecomIdMap, selectedDepartmentId, loading, error, success]);

    // ฟังก์ชันสำหรับ Fetch ข้อมูลทั้งหมดจาก Backend
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');

        try {
            interface RawEmployee {
                workdayId: string;
                empCode: string;
                empName: string;
                deptCode: string;
                deptName: string;
            }

            // ดึงข้อมูลพนักงาน Active
            const empRes = await axios.get<RawEmployee[]>(EMPLOYEE_ACTIVE_API_PROXY);
            const rawEmployees = empRes.data || [];

            const activeEmployees: Employee[] = rawEmployees.map((emp) => ({
                id: emp.empCode || '',
                name: emp.empName || '',
                deptCode: emp.deptCode || '',
                deptName: emp.deptName || '',
                workdayId: emp.workdayId || '',
            }));

            // ดึงข้อมูล LineUser ที่มีอยู่แล้วจาก Backend
            const lineUsersRes = await axios.get<LineUser[]>(LINE_USERS_API_PROXY);
            const lineUsers = lineUsersRes.data || [];

            // สร้าง Map ของ WeCom ID ที่มีอยู่แล้วสำหรับเข้าถึงได้ง่าย
            const initialWeComMap = new Map<string, { weComId: string; backendId?: number; workdayId?: string; originalLineUser?: LineUser }>();
            lineUsers.forEach(lu => {
                const employee = activeEmployees.find(emp => emp.id === lu.employeeCode);
                if (employee && lu.employeeCode) {
                    initialWeComMap.set(lu.employeeCode, {
                        weComId: lu.weComId || '', // เก็บค่าว่าง '' ถ้าเป็น null จาก backend
                        backendId: lu.id,
                        workdayId: employee.workdayId,
                        originalLineUser: lu // เก็บข้อมูล LineUser เดิมไว้ทั้งหมด
                    });
                }
            });

            // จัดกลุ่มพนักงานตามแผนก
            const departmentMap = new Map<string, Department>();

            activeEmployees.forEach(emp => {
                const deptId = emp.deptCode || 'unknown';
                const deptName = emp.deptName || 'Unknown department';

                if (!departmentMap.has(deptId)) {
                    departmentMap.set(deptId, {
                        id: deptId,
                        name: deptName,
                        employees: [],
                    });
                }

                const dept = departmentMap.get(deptId)!;
                const existingWeComData = initialWeComMap.get(emp.id);
                dept.employees.push({
                    ...emp,
                    wecom_id: existingWeComData?.weComId || '',
                    backendLineUserId: existingWeComData?.backendId
                });
            });

            const fetchedDepartments = Array.from(departmentMap.values());

            // อัปเดต State
            setDepartments(fetchedDepartments);
            setWecomIdMap(initialWeComMap);
            setOriginalWecomIdMap(new Map(initialWeComMap)); // อัปเดต original map ด้วยข้อมูลใหม่ทั้งหมด
        } catch (err) {
            console.error('Error fetching data:', err);
            if (axios.isAxiosError(err) && err.response?.data?.message) {
                setError(`Failed to load data: ${err.response.data.message}`);
            } else {
                setError('Failed to load data, please try again');
            }
        } finally {
            setLoading(false);
        }
    }, [EMPLOYEE_ACTIVE_API_PROXY, LINE_USERS_API_PROXY]);

    // เรียก fetchData ครั้งแรกเมื่อ component โหลด
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ตั้งเวลาล้างข้อความ success/error
    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess('');
                setError('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

  // กรองพนักงานตามแผนกที่เลือกและเรียงลำดับ
  const currentDepartmentEmployees = useMemo(() => {
    if (!selectedDepartmentId) return [];
    const dept = departments.find(d => d.id === selectedDepartmentId);
    return dept ? dept.employees.sort((a, b) => {
      const nameA = a.name ?? '';
      const nameB = b.name ?? '';
      return nameA.localeCompare(nameB);
    }) : [];
  }, [selectedDepartmentId, departments]);

  // ฟังก์ชันค้นหา
  useEffect(() => {
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }
    const lower = searchTerm.toLowerCase();
    const results: { deptId: string; deptName: string; employeeName: string; employeeId: string }[] = [];
    departments.forEach(dept => {
      // ตรงชื่อแผนก
      if (dept.name.toLowerCase().includes(lower)) {
        results.push({ deptId: dept.id, deptName: dept.name, employeeName: '', employeeId: '' });
      }
      dept.employees.forEach(emp => {
        if (
          emp.name.toLowerCase().includes(lower) ||
          emp.id.toLowerCase().includes(lower)
        ) {
          results.push({ deptId: dept.id, deptName: dept.name, employeeName: emp.name, employeeId: emp.id });
        }
      });
    });
    setSearchResults(results);
  }, [searchTerm, departments]);

    // Handle การเปลี่ยนแปลง WeCom ID ในช่อง input
    const handleWeComIdChange = useCallback((employeeId: string, newWeComId: string, backendId?: number, workdayId?: string) => {
        setWecomIdMap(prevMap => {
            const newMap = new Map(prevMap);
            const existingData = prevMap.get(employeeId);

            newMap.set(employeeId, {
                weComId: newWeComId,
                backendId: backendId,
                originalLineUser: existingData?.originalLineUser, // รักษาข้อมูล originalLineUser ไว้
                workdayId: workdayId,
            });
            return newMap;
        });
        setSaveMsg('Please save to confirm changes');
        setError('');
        setSuccess('');
    }, []);

    // ฟังก์ชันสำหรับบันทึกการเปลี่ยนแปลงทั้งหมดไปยัง Backend
    const handleSaveAllWeComIds = async () => {
        setSaving(true);
        setSaveMsg('Checking and recording data...');
        setError('');
        setSuccess('');

        try {
            const changesToProcess: { employeeCode: string; weComId: string; backendId?: number; workdayId?: string; type: 'CREATE' | 'UPDATE'; originalLineUser?: LineUser }[] = [];

            wecomIdMap.forEach((currentData, employeeCode) => {
                const originalData = originalWecomIdMap.get(employeeCode) || { weComId: '', backendId: undefined, workdayId: undefined, originalLineUser: undefined };

                const currentWeComIdTrim = currentData.weComId ? currentData.weComId.trim() : '';
                const originalWeComIdTrim = originalData.weComId ? originalData.weComId.trim() : '';
                const employeeCodeTrim = employeeCode.toString().trim();

                const lineUserExistsInBackend = originalData.backendId !== undefined && originalData.backendId !== null && originalData.originalLineUser !== undefined;

                const isWeComIdChanged = currentWeComIdTrim !== originalWeComIdTrim;

                if (isWeComIdChanged) {
                    if (!lineUserExistsInBackend && currentWeComIdTrim !== '') {
                        changesToProcess.push({
                            employeeCode: employeeCodeTrim,
                            weComId: currentWeComIdTrim,
                            backendId: undefined,
                            workdayId: currentData.workdayId,
                            type: 'CREATE',
                            originalLineUser: undefined
                        });
                    } else if (lineUserExistsInBackend) {
                        changesToProcess.push({
                            employeeCode: employeeCodeTrim,
                            weComId: currentWeComIdTrim,
                            backendId: originalData.backendId,
                            workdayId: originalData.workdayId,
                            type: 'UPDATE',
                            originalLineUser: originalData.originalLineUser
                        });
                    }
                }
            });

            if (changesToProcess.length === 0) {
                setSaveMsg('No changes to update');
                setSuccess('No new data to save');
                setSaving(false);
                return;
            }

            const results = await Promise.allSettled(
                changesToProcess.map(async (item) => {
                    let payload: LineUser;
                    const employeeDetails = departments.flatMap(d => d.employees).find(emp => emp.id.toString().trim() === item.employeeCode);

                    if (item.type === 'CREATE') {
                        payload = {
                            id: 0,
                            userId: "Line_token",
                            employeeCode: item.employeeCode,
                            displayName: employeeDetails?.name || '',
                            lastMessage: '',
                            updatedAt: new Date().toISOString(),
                            workdayId: item.workdayId || employeeDetails?.workdayId || '',
                            deptlist: employeeDetails?.deptName || '',
                            language: 'TH',
                            createAt: new Date().toISOString(),
                            weComId: item.weComId,
                        };

                        console.log("Sending POST request for new LineUser");
                        console.log("Payload:", payload);

                        const response = await axios.post<LineUser>(LINE_USERS_API_PROXY, payload);
                        setWecomIdMap(prevMap => {
                            const newMap = new Map(prevMap);
                            newMap.set(item.employeeCode, {
                                weComId: item.weComId,
                                backendId: response.data.id,
                                workdayId: item.workdayId,
                                originalLineUser: response.data
                            });
                            return newMap;
                        });
                    } else if (item.type === 'UPDATE') {
                        const originalLineUser = item.originalLineUser;

                        if (!originalLineUser || originalLineUser.id === undefined || originalLineUser.id === null) {
                            console.warn(`Attempted to UPDATE LineUser without valid backendId for employeeCode: ${item.employeeCode}. Skipping.`);
                            return Promise.reject(new Error(`Cannot update WeCom ID for employee ${item.employeeCode}: ID or original data not found in the system`));
                        }

                        payload = {
                            ...originalLineUser,
                            id: originalLineUser.id,
                            weComId: item.weComId, // ส่งค่าตามที่ป้อน (รวมถึง "")
                            updatedAt: new Date().toISOString(),
                        };

                        const url = `${LINE_USERS_API_PROXY}/${originalLineUser.id.toString().trim()}`;
                        console.log(`Sending PUT request for LineUser id: ${originalLineUser.id}`);
                        console.log("PUT URL:", url);
                        console.log("Payload:", payload);

                        const response = await axios.put<LineUser>(url, payload);
                        setWecomIdMap(prevMap => {
                            const newMap = new Map(prevMap);
                            newMap.set(item.employeeCode, {
                                weComId: response.data.weComId || '',
                                backendId: response.data.id,
                                workdayId: item.workdayId,
                                originalLineUser: response.data
                            });
                            return newMap;
                        });
                    }
                })
            );

            const failedUpdates = results.filter(result => result.status === 'rejected');
            if (failedUpdates.length > 0) {
                const errorMessages = failedUpdates.map(result => (result as PromiseRejectedResult).reason.message).join('\n');
                setError(`Some errors occurred during saving:\n${errorMessages}`);
                setSaveMsg('Partial save successful');
            } else {
                setSaveMsg('Save successful');
                setSuccess('All WeCom ID data saved successfully');
            }

            await fetchData();

        } catch (err) {
            console.error('Error saving WeCom IDs:', err);
            if (axios.isAxiosError(err) && err.response?.data?.message) {
                setError(`Failed to save: ${err.response.data.message}`);
            } else {
                setError('Failed to save data');
            }
            setSaveMsg('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    // การแสดงผล UI (JSX)
    if (loading) return  <div className="flex justify-center items-center h-screen bg-gray-100">
                    <Spinner />
            </div>;
    if (error && !saving) return <div className="flex items-center justify-center min-h-screen text-red-600 font-semibold">เกิดข้อผิดพลาด: {error}</div>;
    if (!departments || departments.length === 0) return <div className="flex items-center justify-center min-h-screen text-gray-700">ไม่พบข้อมูลแผนก</div>;

    return (
        
        <div className="container mx-auto px-4 py-4">
          <h2 className="text-3xl font-extrabold text-gray-900 flex-grow">
        <span className="text-blue-600">WeCom ID</span> Settings
      </h2>
      <p className="text-gray-600 text-base mb-8 border-b border-blue-100 pb-5 mt-[8px]">
      Manage WeCom ID for employees to enable notifications via WeCom
    </p>

    {}
  <div className="w-full  bg-white rounded-xl shadow-lg p-2 py-[24px] border border-gray-200 mb-2">
    <div className="flex items-center mb-3">
    </div>
      <h3 className="text-xl font-bold text-gray-700 mb-2 flex items-center">
        <i className="fas fa-building mr-3 text-gray-800"></i> Search by name, employee code, or department name.
      </h3>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search by name, employee code, or department name..."
          className="block w-full px-5 py-3 text-base text-gray-800 bg-white border border-blue-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 ease-in-out"
        />
        {searchTerm && searchResults.length > 0 && (
          <ul className="absolute z-10 w-full bg-white border border-blue-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
            {searchResults.map((result, idx) => (
              <li
                key={idx}
                className="px-4 py-2 hover:bg-blue-100 cursor-pointer text-gray-800"
                onClick={() => {
                  setSelectedDepartmentId(result.deptId);
                  setSearchTerm('');
                }}
              >
                {result.employeeName
                  ? `${result.employeeName} (${result.employeeId}) - ${result.deptName}`
                  : `${result.deptName}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
    {selectedDepartmentId && (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200  mb-4">
        <h4 className="text-xl font-bold text-gray-800 mb-5 pb-4 border-b border-gray-200 flex items-center py-4">
          <i className="fas fa-users mr-3 text-gray-600"></i>
          Employees in department: <span className="text-blue-600 ml-2">{departments.find((d) => d.id === selectedDepartmentId)?.name}</span>
        </h4>
        {currentDepartmentEmployees.length === 0 ? (
          <p className="text-gray-500 text-center py-6 text-lg">
            <i className="fas fa-exclamation-circle mr-2"></i>No employees found in this department
          </p>
        ) : (
          <div className="overflow-x-auto shadow-md rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">
                    Employee ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-blue-700 uppercase tracking-wider">
                    WeCom ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-blue-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {currentDepartmentEmployees.map((employee, index) => {
                  const empId = employee?.id ?? `no-id-${index}`;
                  const empName = employee?.name ?? `no-name-${index}`;
                  const key = `${empId}-${empName}`;

                  return (
                    <tr key={key} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee?.name || 'Unknown name'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {employee?.id || 'No ID'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 w-1/3">
                        <input
                          type="text"
                          value={wecomIdMap.get(employee?.id ?? '')?.weComId || ''}
                          onChange={(e) =>
                            handleWeComIdChange(employee?.id ?? '', e.target.value, wecomIdMap.get(employee?.id ?? '')?.backendId, employee.workdayId)
                          }
                          className="block w-full px-4 py-2 text-sm text-gray-800 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 transition duration-150 ease-in-out"
                          placeholder="Enter WeCom ID"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {wecomIdMap.get(employee?.id ?? '')?.weComId && (
                          <button
                            onClick={() =>
                              handleWeComIdChange(employee?.id ?? '', '', wecomIdMap.get(employee?.id ?? '')?.backendId, employee.workdayId)
                            }
                            className="text-red-600 hover:text-red-800 ml-4 px-4 py-2 rounded-lg border border-red-300 hover:border-red-500 transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            title="Reset WeCom ID for this employee"
                          >
                            <i className="fas fa-trash-alt mr-1"></i> Reset
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody> 
            </table>
          </div>
        )}
      </div>
    )}

    <div className='py-4'>
    <button
      onClick={handleSaveAllWeComIds}
      className="w-full inline-flex justify-center items-center px-6 py-3 border
       border-transparent text-base font-medium rounded-lg shadow-lg text-white bg-green-500 hover:bg-green-700
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-60 disabled:cursor-not-allowed 
        transform transition duration-150 ease-in-out hover:scale-105"
      disabled={saving}
    >
      {saving ? (
        <>
          <i className="fas fa-spinner fa-spin mr-3"></i> Saving...
        </>
      ) : (
        <>
          <i className="fas fa-save mr-3"></i> Save All WeCom ID Settings
        </>
      )}
    </button>
    {saveMsg && (
      <div className="mt-6 text-center text-base font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md p-3 shadow-sm">
        <i className="fas fa-hourglass-half mr-2"></i> {saveMsg}
      </div>
    )}
    {success && (
      <div className="mt-6 text-center text-base font-medium text-green-300 bg-green-50 border border-green-200 rounded-md p-3 shadow-sm">
        <i className="fas fa-check-circle mr-2"></i> {success}
      </div>
    )}
    {error && (
      <div className="mt-6 text-center text-base font-medium text-red-700 bg-red-50 border border-red-200 rounded-md p-3 shadow-sm">
        <i className="fas fa-times-circle mr-2"></i> {error}
      </div>
    )}
  </div>
  </div>
    );
  }