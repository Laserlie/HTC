//..\components\ManpowerTable.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { PiFileMagnifyingGlassBold } from 'react-icons/pi';
import Spinner from './ui/Spinner';

export type Employee = {
  deptcode: string;
  deptname: string;
  deptsbu: string;
  deptstd: string;
  countscan: string;
  countnotscan: string;
  countperson: string;
  workdate: string;
  deptcodelevel1: string; 
  deptcodelevel2: string;
  deptcodelevel3: string;
  deptcodelevel4: string;
  parentcode: string | null;
  PersonType: string | null;
  PersonGroup: string | null;
};

type ManpowerTableProps = {
  selectedDate: string;
  scanStatus: string;
  deptcodelevel1Filter?: string;
};

type AggregatedDepartment = {
  deptcode: string;
  deptname: string;
  deptsbu: string;
  deptstd: string;
  totalScanned: number;
  totalNotScanned: number;
  totalPerson: number;

  deptcodelevel1: string;
  deptcodelevel2: string;
  deptcodelevel3: string;
  deptcodelevel4: string;
};


const getDeptLevel = (dept: AggregatedDepartment): number => {
  const level2 = dept.deptcodelevel2;
  const level3 = dept.deptcodelevel3;
  const level4 = dept.deptcodelevel4;

  if (level2 === '00' && level3 === '00' && level4 === '00') {
    return 1;
  }
  if (level3 === '00' && level4 === '00') {
    return 2;
  }
  if (level4 === '00') {
    return 3;
  }
  return 4; // Default to level 4 if none of the above match
};

export function ManpowerTable({ selectedDate, scanStatus, deptcodelevel1Filter }: ManpowerTableProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Lazy loading states
  const PAGE_SIZE = 30;
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setPage(1);
    setEmployees([]);
    setHasMore(true);
  }, [selectedDate, deptcodelevel1Filter]);

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      setError(null);
      try {
        // เพิ่ม query สำหรับ pagination
        const response = await fetch(`/api/department?date=${selectedDate}&page=${page}&pageSize=${PAGE_SIZE}`);
        if (!response.ok) {
          throw new Error('Failed to fetch employees');
        }
        const data: Employee[] = await response.json();
        if (page === 1) {
          setEmployees(data);
        } else {
          setEmployees(prev => [...prev, ...data]);
        }
        setHasMore(data.length === PAGE_SIZE);
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [selectedDate, page, deptcodelevel1Filter]);

  const aggregatedDepartments = useMemo<AggregatedDepartment[]>(() => {
    const departmentMap = new Map<string, AggregatedDepartment>();

    employees.forEach(emp => {
      if (deptcodelevel1Filter && emp.deptcodelevel1 !== deptcodelevel1Filter) {
        return;
      }

      let currentDept = departmentMap.get(emp.deptcode);
      if (!currentDept) {
        currentDept = {
          deptcode: emp.deptcode,
          deptname: emp.deptname,
          deptsbu: emp.deptsbu,
          deptstd: emp.deptstd,
          totalScanned: 0,
          totalNotScanned: 0,
          totalPerson: 0,
          deptcodelevel1: emp.deptcodelevel1,
          deptcodelevel2: emp.deptcodelevel2,
          deptcodelevel3: emp.deptcodelevel3,
          deptcodelevel4: emp.deptcodelevel4,
        };
        departmentMap.set(emp.deptcode, currentDept);
      }

      currentDept.totalScanned += Number(emp.countscan);
      currentDept.totalNotScanned += Number(emp.countnotscan);
      currentDept.totalPerson += Number(emp.countperson);
    });

    const sortedDepartments = Array.from(departmentMap.values()).sort((a, b) => {
      return a.deptcode.localeCompare(b.deptcode);
    });

    return sortedDepartments;
  }, [employees, deptcodelevel1Filter]);

  const filteredDepartments = useMemo(() => {
    if (scanStatus === 'scanned') {
      return aggregatedDepartments.filter(dept => dept.totalScanned > 0);
    }
    if (scanStatus === 'not_scanned') {
      return aggregatedDepartments.filter(dept => dept.totalNotScanned > 0);
    }
    return aggregatedDepartments;
  }, [aggregatedDepartments, scanStatus]);


  if (loading) {
    return (
      <div className="flex justify-center items-center p-4">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (filteredDepartments.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        ไม่พบข้อมูลสำหรับโรงงานนี้
      </div>
    );
  }

  const levelColors = [
    'bg-white',    
    'bg-blue-100', 
    'bg-blue-50',  
    'bg-gray-100', 
    'bg-white',    
  ];

  return (
    <div className="overflow-x-auto bg-blue-50 rounded-xl shadow p-7">
      <table className="min-w-full text-sm text-center border-collapse ">
        <thead className="border border-blue-500 rounded-md text-white bg-blue-800 ">
          <tr>
            <th className="py-2 px-6">รหัสแผนก</th>
            <th className="py-2 px-6 ">ชื่อแผนก</th>
            <th className="py-2 px-6">SBU</th>
            <th className="py-2 px-6">STD</th>
            {scanStatus !== 'not_scanned' && (
              <th className="py-2 px-6">สแกนแล้ว</th>
            )}
            {scanStatus !== 'scanned' && (
              <th className="py-2 px-6">ยังไม่สแกน</th>
            )}
            <th className="py-2 px-6">รวมทั้งหมด</th>
            <th className="p-0">ดูรายละเอียด</th>
          </tr>
        </thead>
        <tbody>
          {filteredDepartments.map((dept) => {
            const linkDeptcode = dept.deptcode;
            const linkWorkdate = selectedDate;

            const deptLevel = getDeptLevel(dept);
            const paddingLeft = (deptLevel - 1) * 25;

            const rowBgClass = levelColors[deptLevel > 0 && deptLevel <= 4 ? deptLevel - 1 : 0];
            const verticalPaddingClass = (deptLevel === 1 || deptLevel === 2) ? 'py-3' : 'py-2';
            const displayedDeptCode = dept.deptcode;

            const isBlueRow = (deptLevel === 1 || deptLevel === 2);

            const hasNonZeroValue = dept.totalScanned !== 0 || dept.totalNotScanned !== 0 || dept.totalPerson !== 0;

            const displayedTotalScanned = (isBlueRow && !hasNonZeroValue) ? '' : dept.totalScanned;
            const displayedTotalNotScanned = (isBlueRow && !hasNonZeroValue) ? '' : dept.totalNotScanned;
            const displayedTotalPerson = (isBlueRow && !hasNonZeroValue) ? '' : dept.totalPerson;

            const shouldHideIcon = isBlueRow && !hasNonZeroValue;

            const handleLinkClick = () => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('prevDashboardDate', selectedDate);
              }
            };

            return (
              <tr key={dept.deptcode} className={`${rowBgClass} border-b border-gray-100 last:border-b-0`}>
                <td className={`px-6 ${verticalPaddingClass}`}>{displayedDeptCode}</td>
                <td className={`px-6 text-left ${verticalPaddingClass}`} style={{ paddingLeft: `${paddingLeft}px` }}>
                  {dept.deptname}
                </td>
                <td className={`px-5 ${verticalPaddingClass}`}>{dept.deptsbu}</td>
                <td className={`px-6 ${verticalPaddingClass}`}>{dept.deptstd}</td>
                {scanStatus !== 'not_scanned' && (
                  <td className={`px-6 ${verticalPaddingClass}`}>{displayedTotalScanned}</td>
                )}
                {scanStatus !== 'scanned' && (
                  <td className={`px-6 ${verticalPaddingClass}`}>{displayedTotalNotScanned}</td>
                )}
                <td className={`px-6 ${verticalPaddingClass}`}>{displayedTotalPerson}</td>
                <td className={`p-3 ${verticalPaddingClass}`}>
                  {shouldHideIcon ? (
                    ''
                  ) : (
                    <Link href={`/report/${linkDeptcode}?workdate=${linkWorkdate}`} onClick={handleLinkClick}>
                      <PiFileMagnifyingGlassBold size={30} className="text-blue-500 hover:text-blue-700" />
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* Lazy loading: Load more button */}
      {hasMore && !loading && (
        <div className="flex justify-center mt-4">
          <button
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            onClick={() => setPage(p => p + 1)}
          >
            โหลดเพิ่มเติม
          </button>
        </div>
      )}
      {loading && page > 1 && (
        <div className="flex justify-center items-center p-4">
          <Spinner />
        </div>
      )}
    </div>
  );
}