'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Spinner from '@/components/ui/Spinner';
import { FiAlertTriangle } from 'react-icons/fi';
import { FaUserPlus, FaUsers, FaUserClock } from 'react-icons/fa';

type EmployeeDetail = {
  workdate: string;
  person_code: string;
  deptcode: string;
  deptname: string;
  full_name: string;
  department_full_paths: string;
  firstscantime: string | null;
  shiftname: string | null;
  PersonType: string;
};

type ApiResponse = {
  deptname: string;
  detil: EmployeeDetail[];
  total_employees_prev_month?: number;
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    console.error('Render Error:', error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg shadow-md max-w-lg mx-auto mt-10">
          <h2 className="text-xl font-bold mb-2 flex items-center justify-center">
            <FiAlertTriangle className="mr-2" />
            เกิดข้อผิดพลาดขณะเรนเดอร์!
            </h2>
            <p>{this.state.error?.message || 'Unknown error'}</p>
            </div>
      );
    }
    return this.props.children;
  }
}

const PAGE_SIZE = 50;

const ScanNoscanReportPageInner = () => {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const initialDeptCodeFromUrl = searchParams.get('deptcode');

  const [allEmployees, setAllEmployees] = useState<EmployeeDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeptPrefix, setSelectedDeptPrefix] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const deptPrefixes = useMemo(() => ([
    { value: "06", label: "Platform" },
    { value: "07", label: "AC EMC Micro" },
    { value: "08", label: "RF EMC Micro" },
    { value: "09", label: "FUL FILL" },
  ]), []);

  // สร้าง state สำหรับวันที่ปัจจุบัน
  const today = useMemo(() => {
    return new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }, []);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      // ไม่ต้องส่ง from และ to ไปใน URL
      if (initialDeptCodeFromUrl) params.append('deptcode', initialDeptCodeFromUrl);

      const response = await fetch(`/api/attendance/report/ScanNoscan?${params.toString()}`);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = {};
        }
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data: ApiResponse = await response.json();
      setAllEmployees(data.detil);
    } catch (err: unknown) {
      setError('ไม่สามารถดึงข้อมูลพนักงานได้ โปรดลองอีกครั้ง');
      if (err instanceof Error) {
        console.error('API Fetch Error:', err.message);
      } else {
        console.error('API Fetch Error:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [initialDeptCodeFromUrl]); // นำ from, to ออกจาก Dependency Array

  useEffect(() => {
    // แก้ไขเงื่อนไขการเรียก fetchEmployees ให้เริ่มทำงานทันที
    fetchEmployees();
  }, [fetchEmployees]);

  // Use useMemo to filter employees, reducing unnecessary re-renders
  const filteredEmployees = useMemo(() => {
    let currentFiltered = allEmployees;

    if (selectedDeptPrefix) {
      currentFiltered = currentFiltered.filter(emp =>
        emp.deptcode && emp.deptcode.startsWith(selectedDeptPrefix)
      );
    }

    if (status === 'scanned') {
      currentFiltered = currentFiltered.filter(emp => emp.firstscantime !== null);
    } else if (status === 'not_scanned') {
      currentFiltered = currentFiltered.filter(emp => emp.firstscantime === null);
    }
    
    // Sort employees to ensure consistent grouping
    currentFiltered.sort((a, b) => {
      if (a.deptcode < b.deptcode) return -1;
      if (a.deptcode > b.deptcode) return 1;
      return a.full_name.localeCompare(b.full_name);
    });

    return currentFiltered;
  }, [allEmployees, selectedDeptPrefix, status]);

  // Reset visibleCount whenever the filtered data changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filteredEmployees]);

  const getPageTitle = useCallback(() => {
    switch (status) {
      case 'all': return 'รายงานพนักงานทั้งหมด';
      case 'scanned': return 'รายงานพนักงานที่สแกนแล้ว';
      case 'not_scanned': return 'รายงานพนักงานที่ยังไม่สแกน';
      default: return 'รายงานการเข้างาน';
    }
  }, [status]);

  const getTitleIcon = useCallback(() => {
    switch (status) {
      case 'all': return <FaUsers className="text-gray-600 mr-2" />;
      case 'scanned': return <FaUserClock className="text-green-600 mr-2" />;
      case 'not_scanned': return <FaUserPlus className="text-red-600 mr-2" />;
      default: return null;
    }
  }, [status]);

  const groupEmployeesByDepartment = (empList: EmployeeDetail[]) => {
    const grouped: { [key: string]: { deptName: string; employees: EmployeeDetail[] } } = {};
    empList.forEach(emp => {
      if (!grouped[emp.deptcode]) {
        grouped[emp.deptcode] = { deptName: emp.deptname, employees: [] };
      }
      grouped[emp.deptcode].employees.push(emp);
    });
    return grouped;
  };

  const groupedEmployees = useMemo(() => groupEmployeesByDepartment(filteredEmployees), [filteredEmployees]);

  const flatEmployees = useMemo(() => {
    const rows: Array<{ type: 'dept'; deptCode: string; deptName: string; count: number } | { type: 'emp'; employee: EmployeeDetail }> = [];
    Object.keys(groupedEmployees).forEach(deptCodeKey => {
      rows.push({ type: 'dept', deptCode: deptCodeKey, deptName: groupedEmployees[deptCodeKey].deptName, count: groupedEmployees[deptCodeKey].employees.length });
      groupedEmployees[deptCodeKey].employees.forEach(employee => {
        rows.push({ type: 'emp', employee });
      });
    });
    return rows;
  }, [groupedEmployees]);

  const visibleRows = flatEmployees.slice(0, visibleCount);

  useEffect(() => {
    if (!loaderRef.current) return;
    if (visibleCount >= flatEmployees.length) return;

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, flatEmployees.length));
        }
      },
      { root: null, rootMargin: '0px', threshold: 1.0 }
    );
    observer.observe(loaderRef.current);

    return () => {
      observer.disconnect();
    };
  }, [visibleCount, flatEmployees.length]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-600 bg-red-50 rounded-lg shadow-md max-w-lg mx-auto mt-10">
        <h2 className="text-xl font-bold mb-2 flex items-center justify-center">
          <FiAlertTriangle className="mr-2" />
          เกิดข้อผิดพลาด!
        </h2>
        <p>{error}</p>
        <p className="mt-4 text-sm text-red-500">กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="container mx-auto p-4 space-y-6">
        <p className="text-2xl mb-4 font-extrabold text-center text-gray-600 flex items-center justify-center">
          {getTitleIcon()} {getPageTitle()}
        </p>
        <p className="text-xl text-gray-600 mb-4 text-center">
          {/* แสดงวันที่ปัจจุบันแทนค่าจาก URL */}
          วันที่: <span className="font-bold text-gray-800">{today}</span>
        </p>

        <div className="flex justify-left mb-8 text-left p-1">
          <div className='container mx-auto'>
            <label htmlFor="deptPrefixFilter" className="sr-only text-center">เลือกฝ่ายโรงงาน</label>
            <select
              id="deptPrefixFilter"
              value={selectedDeptPrefix}
              onChange={(e) => setSelectedDeptPrefix(e.target.value)}
              className="w-1/4 border rounded-lg px-2 py-2 shadow-sm"
            >
              <option value="">ทั้งหมด</option>
              {deptPrefixes.map(prefix => (
                <option key={prefix.value} value={prefix.value}>
                  {prefix.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredEmployees.length === 0 ? (
          <div className="text-center text-gray-500 p-2 bg-white rounded-lg shadow-xl max-w-2xl mx-auto mt-10 border border-gray-200">
            <p className="text-2xl font-semibold mb-2">ไม่พบข้อมูลพนักงานสำหรับเงื่อนไขนี้</p>
            <p className="text-lg text-gray-600">โปรดตรวจสอบวันที่หรือรหัสแผนกที่เลือกอีกครั้ง</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl shadow-xl p-1.5 border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-sky-600 to-blue-700">
                <tr>
                  <th className="py-3 px-6 text-left text-white font-semibold tracking-wide">Emp ID</th>
                  <th className="py-3 px-6 text-left text-white font-semibold tracking-wide">Name</th>
                  <th className="py-3 px-6 text-left text-white font-semibold tracking-wide">Deptname</th>
                  <th className="py-3 px-6 text-left text-white font-semibold tracking-wide">Workdate</th>
                  <th className="py-3 px-6 text-left text-white font-semibold tracking-wide">Time</th>
                  <th className="py-3 px-6 text-left text-white font-semibold tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visibleRows.map((row, idx) =>
                  row.type === 'dept' ? (
                    <tr className="bg-blue-100 text-blue-800 font-semibold" key={`dept-${row.deptCode}-${idx}`}>
                      <td colSpan={6} className="py-3 px-6">
                        {row.deptName} ({row.count})
                      </td>
                    </tr>
                  ) : (
                    <tr key={`${row.employee.person_code}-${row.employee.workdate}`} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2 px-6">{row.employee.person_code}</td>
                      <td className="py-2 px-6">{row.employee.full_name}</td>
                      <td className="py-2 px-6">{row.employee.deptname}</td>
                      <td className="py-2 px-6">{row.employee.workdate}</td>
                      <td className="py-2 px-6">
                        {row.employee.firstscantime ? row.employee.firstscantime.substring(11, 19) : '-'}
                      </td>
                      <td className="py-2 px-6">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            !row.employee.firstscantime
                              ? 'bg-red-100 text-red-800'
                              : (() => {
                                const [h, m, s] = row.employee.firstscantime.substring(11, 19).split(':').map(Number);
                                return h > 8 || (h === 8 && (m > 0 || s > 0))
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800';
                              })()
                          }`}
                        >
                          {!row.employee.firstscantime
                            ? 'ยังไม่สแกน'
                            : (() => {
                                const [h, m, s] = row.employee.firstscantime.substring(11, 19).split(':').map(Number);
                                return h > 8 || (h === 8 && (m > 0 || s > 0)) ? 'มาสาย' : 'สแกนแล้ว';
                              })()}
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
            {visibleCount < flatEmployees.length && (
              <div ref={loaderRef} className="flex justify-center my-4">
                <span className="px-4 py-2 text-gray-600 rounded shadow text-sm animate-pulse">
                  กำลังโหลด...
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function PageWithBoundary() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="flex justify-center items-center h-screen bg-gray-50"><Spinner/></div>}>
        <ScanNoscanReportPageInner />
      </Suspense>
    </ErrorBoundary>
  );
}