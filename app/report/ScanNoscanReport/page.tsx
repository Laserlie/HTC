'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Spinner from '@/components/ui/Spinner';
import { ArrowLeft } from 'lucide-react';

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

const PAGE_SIZE = 50;

const ScanNoscanReportPage = () => {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const initialDeptCodeFromUrl = searchParams.get('deptcode');
  const router = useRouter();

  const [allEmployees, setAllEmployees] = useState<EmployeeDetail[]>([]);
  const [employees, setEmployees] = useState<EmployeeDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDeptPrefix, setSelectedDeptPrefix] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  const uniqueDeptPrefixes = useMemo(() => {
    const prefixes = new Set<string>();
    allEmployees.forEach(emp => {
      if (emp.deptcode && emp.deptcode.length >= 2) {
        prefixes.add(emp.deptcode.substring(0, 2));
      }
    });
    const sortedPrefixes = Array.from(prefixes).sort();
    return sortedPrefixes;
  }, [allEmployees]);


  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (initialDeptCodeFromUrl) params.append('deptcode', initialDeptCodeFromUrl);
      if (from) params.append('from', from);
      if (to) params.append('to', to);

      const response = await fetch(`/api/attendance/report/ScanNoscan?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse = await response.json();
      setAllEmployees(data.detil);

    } catch (err) {
      setError('ไม่สามารถดึงข้อมูลพนักงานได้ โปรดลองอีกครั้ง');
      console.error('API Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  }, [from, to, initialDeptCodeFromUrl]);

  useEffect(() => {
    let currentFilteredEmployees = allEmployees;

    if (selectedDeptPrefix) {
      currentFilteredEmployees = currentFilteredEmployees.filter(emp =>
        emp.deptcode && emp.deptcode.startsWith(selectedDeptPrefix)
      );
    }

    if (status === 'scanned') {
      currentFilteredEmployees = currentFilteredEmployees.filter(emp => emp.firstscantime !== null);
    } else if (status === 'not_scanned') {
      currentFilteredEmployees = currentFilteredEmployees.filter(emp => emp.firstscantime === null);
    }

    setEmployees(currentFilteredEmployees);
  }, [allEmployees, selectedDeptPrefix, status]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE); // reset visible count on filter change
  }, [allEmployees, selectedDeptPrefix, status]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const getPageTitle = () => {
    switch (status) {
      case 'all': return 'รายงานพนักงานทั้งหมด';
      case 'scanned': return 'รายงานพนักงานที่สแกนแล้ว';
      case 'not_scanned': return 'รายงานพนักงานที่ยังไม่สแกน';
      default: return 'รายงานการเข้างาน';
    }
  };

  const groupEmployeesByDepartment = (employees: EmployeeDetail[]) => {
    const grouped: { [key: string]: { deptName: string; employees: EmployeeDetail[] } } = {};
    employees.forEach(emp => {
      if (!grouped[emp.deptcode]) {
        grouped[emp.deptcode] = { deptName: emp.deptname, employees: [] };
      }
      grouped[emp.deptcode].employees.push(emp);
    });
    return grouped;
  };

  const groupedEmployees = groupEmployeesByDepartment(employees);

  // Lazy loading: flatten grouped employees for rendering
  const flatEmployees = useMemo(() => {
    // flatten groupedEmployees into a list with dept headers
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

  // Auto lazy loading with Intersection Observer
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
        <h2 className="text-xl font-bold mb-2">เกิดข้อผิดพลาด!</h2>
        <p>{error}</p>
        <p className="mt-4 text-sm text-red-500">กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ</p>
      </div>
    );
  }

  return (
    <div className=" bg-gray-50 min-h-screen">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-shadow shadow-md hover:shadow-lg mt-4 ml-4"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back</span>
      </button>
      <p className="text-2xl mb-4 font-extrabold text-center text-gray-600">{getPageTitle()}</p>
      <p className="text-xl text-gray-600 mb-4 text-center">
        วันที่: <span className="font-bold text-gray-800">{to || 'ไม่ได้ระบุ'}</span>
      </p>

      {/* New Dropdown for Department Prefix - EVEN SMALLER VERSION */}
      <div className="flex justify-left mb-8 text-left p-1">
        <label htmlFor="deptPrefixFilter" className="sr-only text-left">เลือกฝ่ายโรงงาน : </label>
        <select
          id="deptPrefixFilter"
          value={selectedDeptPrefix}
          onChange={(e) => setSelectedDeptPrefix(e.target.value)}
          // Adjusted classes for EVEN smaller size: p-1.5 and text-xs
          className="block  max-w-xs p-1 border border-gray-300 rounded-md shadow-sm text-xs focus:ring-blue-500 focus:border-blue-500  "
        >
          <option value="">ทั้งหมด</option>
          {uniqueDeptPrefixes.map(prefix => (
            <option key={prefix} value={prefix}>
              ฝ่ายโรงงาน {prefix}
            </option>
          ))}
        </select>
      </div>



      {employees.length === 0 ? (
        <div className="text-center text-gray-500 p-2 bg-white rounded-lg shadow-xl max-w-2xl mx-auto mt-10 border border-gray-200">
          <p className="text-2xl font-semibold mb-2">ไม่พบข้อมูลพนักงานสำหรับเงื่อนไขนี้</p>
          <p className="text-lg text-gray-600">โปรดตรวจสอบวันที่หรือรหัสแผนกที่เลือกอีกครั้ง</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-2xl p-1.5 border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 ">
            <thead className="bg-gradient-to-r from-sky-600 to-blue-700 text-gray-600 text-md">
              <tr>
                <th className="py-3 px-6 text-left font-semibold tracking-wide">Emp ID</th>
                <th className="py-3 px-6 text-left font-semibold tracking-wide">Name</th>
                <th className="py-3 px-6 text-left font-semibold tracking-wide">Deptname</th>
                <th className="py-3 px-6 text-left font-semibold tracking-wide">Workdate</th>
                <th className="py-3 px-6 text-left font-semibold tracking-wide">Time</th>
                <th className="py-3 px-6 text-left font-semibold tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleRows.map((row, idx) =>
                row.type === 'dept' ? (
                  <tr className="bg-blue-100 text-blue-800 font-semibold" key={`dept-${row.deptCode}-${idx}`}>
                    <td colSpan={6} className="py-3 px-6">
                      {row.deptName} ( {row.count} )
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
              <span className="px-4 py-2 bg-blue-100 text-blue-600 rounded shadow text-sm animate-pulse">
                กำลังโหลด...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScanNoscanReportPage;