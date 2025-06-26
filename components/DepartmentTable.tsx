'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PiFileMagnifyingGlassBold } from 'react-icons/pi';
import { Employee } from '../app/types/employee';

export type AggregatedDepartment = {
  deptcode: string;
  deptname: string;
  deptsbu: string;
  deptstd: string | null;
  totalScanned: number;
  totalNotScanned: number;
  totalPerson: number;
  deptcodelevel1: string;
  deptcodelevel2: string;
  deptcodelevel3: string;
  deptcodelevel4: string;

  workdate: string;
  isTotalRow?: boolean;
};

const getDeptLevel = (dept: AggregatedDepartment): number => {
  if (dept.deptcode.substring(2, 8) === '000000') {
    return 1;
  }
  if (dept.deptcode.substring(4, 8) === '0000') {
    return 2;
  }
  if (dept.deptcode.substring(6, 8) === '00') {
    return 3;
  }
  return 4;
};


export type DepartmentTableProps = {
  employees: Employee[];
  scanStatus?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  selectedDate?: string;
};

export function DepartmentTable({ employees, scanStatus = 'all', onLoadMore, hasMore }: DepartmentTableProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null); 

  const aggregatedDepartments = useMemo<AggregatedDepartment[]>(() => {
    const departmentsMap = new Map<string, AggregatedDepartment>();

    employees.forEach(emp => {
      const fullDeptCode = emp.originalFullDeptcode || emp.deptcode || '';
      const deptcodelevel1 = fullDeptCode.substring(0, 2) + '000000';
      const deptcodelevel2 = fullDeptCode.substring(0, 4) + '0000';
      const deptcodelevel3 = fullDeptCode.substring(0, 6) + '00';
      const deptcodelevel4 = fullDeptCode.substring(0, 8);
      const groupKey = `${emp.workdate}-${fullDeptCode}`;

      let currentDept = departmentsMap.get(groupKey);
      if (!currentDept) {
        currentDept = {
          deptcode: fullDeptCode,
          deptname: emp.deptname,
          deptsbu: emp.deptsbu,
          deptstd: emp.deptstd,
          totalScanned: 0,
          totalNotScanned: 0,
          totalPerson: 0,
          deptcodelevel1: deptcodelevel1,
          deptcodelevel2: deptcodelevel2,
          deptcodelevel3: deptcodelevel3,
          deptcodelevel4: deptcodelevel4,
          workdate: emp.workdate,
          isTotalRow: false,
        };
        departmentsMap.set(groupKey, currentDept);
      }
      currentDept.totalScanned += Number(emp.countscan);
      currentDept.totalNotScanned += Number(emp.countnotscan);
      currentDept.totalPerson += Number(emp.countperson);
    });
    const hierarchicalMap = new Map<string, { dept: AggregatedDepartment; children: AggregatedDepartment[] }>();
    departmentsMap.forEach(dept => {
      hierarchicalMap.set(`${dept.workdate}-${dept.deptcode}`, { dept, children: [] });
    });

    const calculateTotalsIncludingChildren = (fullDeptKey: string): { scanned: number; notScanned: number; person: number } => {
      const entry = hierarchicalMap.get(fullDeptKey);
      if (!entry) {
        return { scanned: 0, notScanned: 0, person: 0 };
      }

      let totalScanned = entry.dept.totalScanned;
      let totalNotScanned = entry.dept.totalNotScanned;
      let totalPerson = entry.dept.totalPerson;
      entry.children.forEach(childDept => {
        const childTotals = calculateTotalsIncludingChildren(`${childDept.workdate}-${childDept.deptcode}`);
        totalScanned += childTotals.scanned;
        totalNotScanned += childTotals.notScanned;
        totalPerson += childTotals.person;
      });

      return { scanned: totalScanned, notScanned: totalNotScanned, person: totalPerson };
    };

    const topLevelDepartments: AggregatedDepartment[] = [];
    const allDepartmentsSortedByCode = Array.from(departmentsMap.values()).sort((a, b) => {
      if (a.workdate !== b.workdate) return a.workdate.localeCompare(b.workdate);
      return a.deptcode.localeCompare(b.deptcode);
    });

 
    allDepartmentsSortedByCode.forEach(dept => {
      const level = getDeptLevel(dept);
      let parentCode: string | null = null;

      if (level === 4) {
        parentCode = dept.deptcodelevel3;
      } else if (level === 3) {
        parentCode = dept.deptcodelevel2;
      } else if (level === 2) {
        parentCode = dept.deptcodelevel1;
      }

      const parentEntryKey = parentCode ? `${dept.workdate}-${parentCode}` : null;
      if (parentEntryKey && hierarchicalMap.has(parentEntryKey)) {
        const parentEntry = hierarchicalMap.get(parentEntryKey);
        if (parentEntry) {
          parentEntry.children.push(dept);
        }
      } else {
        topLevelDepartments.push(dept);
      }
    });

    hierarchicalMap.forEach(entry => {
      entry.children.sort((a, b) => a.deptcode.localeCompare(b.deptcode));
    });

    const finalDisplayList: AggregatedDepartment[] = [];

    const flattenAndAddTotals = (dept: AggregatedDepartment) => {
      const entryKey = `${dept.workdate}-${dept.deptcode}`;
      const entry = hierarchicalMap.get(entryKey);
      if (!entry) return;

      const deptLevel = getDeptLevel(entry.dept);

      finalDisplayList.push({ ...entry.dept, isTotalRow: false });

      entry.children.forEach(child => flattenAndAddTotals(child));
      if (deptLevel === 1 || deptLevel === 2 || (deptLevel === 3 && entry.children.length > 0)) {
        let totalDeptName = '';
        const totalDeptCode = `TOTAL_${entry.dept.deptcode}`;

        const aggregatedTotalsForCurrentNode = calculateTotalsIncludingChildren(entryKey);

        if (deptLevel === 1) {
          totalDeptName = `Grand Total ${entry.dept.deptname}`;
        } else if (deptLevel === 2) {
          totalDeptName = `Total ${entry.dept.deptname}`;
        } else if (deptLevel === 3) {
          totalDeptName = `Total ${entry.dept.deptname}`;
        }

        finalDisplayList.push({
          ...entry.dept,
          deptname: totalDeptName,
          deptcode: totalDeptCode,
          isTotalRow: true,
          deptsbu: '',
          deptstd: null,
          totalScanned: aggregatedTotalsForCurrentNode.scanned,
          totalNotScanned: aggregatedTotalsForCurrentNode.notScanned,
          totalPerson: aggregatedTotalsForCurrentNode.person,
        });
      }
    };

    topLevelDepartments.sort((a, b) => {
      if (a.workdate !== b.workdate) return a.workdate.localeCompare(b.workdate);
      return a.deptcode.localeCompare(b.deptcode);
    });

    topLevelDepartments.forEach(dept => flattenAndAddTotals(dept));

    return finalDisplayList;
  }, [employees]);

  const filteredDepartments = useMemo(() => {
    if (scanStatus === 'scanned') {
      return aggregatedDepartments.filter(dept => dept.totalScanned > 0 || dept.isTotalRow);
    }
    if (scanStatus === 'not_scanned') {
      return aggregatedDepartments.filter(dept => dept.totalNotScanned > 0 || dept.isTotalRow);
    }
    return aggregatedDepartments;
  }, [aggregatedDepartments, scanStatus]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, AggregatedDepartment[]>();
    filteredDepartments.forEach(dept => {
      const date = dept.workdate;
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(dept);
    });
    return Array.from(groups.entries()).sort(([dateA], [dateB]) => dateA.localeCompare(dateB));
  }, [filteredDepartments]);


  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    const currentRef = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 1 }
    );
    if (currentRef) {
      observer.observe(currentRef);
    }
    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [onLoadMore, hasMore, filteredDepartments.length]);

  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (filteredDepartments.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา
      </div>
    );
  }

  const levelColors = [
    'bg-blue-200',
    'bg-blue-100',
    'bg-white',
    'bg-gray-200',
  ];

  return (
    <div className="space-y-6 p-4 bg-gray-50 rounded-xl shadow-inner">
      {groupedByDate.map(([date, departmentsForDate]) => (
        <div
          key={date}
          className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
        >
          <div className="bg-blue-600 text-white p-3 font-bold text-lg">
            {`Date : ${date}`}
          </div>

          <div className="overflow-x-auto p-4">
            <table className="min-w-full text-sm text-center border-collapse">
              <thead className="border-b border-gray-200 text-gray-600 bg-gray-50">
                <tr>
                  <th className="py-2 px-6">Date</th>
                  <th className="py-2 px-6">Deptcode</th>
                  <th className="py-2 px-6">Deptname</th>
                  <th className="py-2 px-6">SBU</th>
                  <th className="py-2 px-6">STD</th>
                  {scanStatus !== 'not_scanned' && (
                    <th className="py-2 px-6">Scan</th>
                  )}
                  {scanStatus !== 'scanned' && (
                    <th className="py-2 px-6">No Scan</th>
                  )}
                  <th className="py-2 px-6">Person</th>
                  <th className="p-0"></th>
                </tr>
              </thead>
              <tbody>
                {departmentsForDate.map((dept, index) => {
                  const linkDeptcode = dept.deptcode.replace('TOTAL_', '');
                  const linkWorkdate = dept.workdate;
                  const deptLevel = getDeptLevel(dept);

                  let totalRowLevel = deptLevel;
                  if (dept.isTotalRow && dept.deptcode.startsWith('TOTAL_')) {
                    const parentDeptcode = dept.deptcode.replace('TOTAL_', '');
                    totalRowLevel = getDeptLevel({ ...dept, deptcode: parentDeptcode });
                  }

                  const paddingLeft = dept.isTotalRow ? 0 : (deptLevel - 1) * 25;

                  const allZeroValues = dept.totalScanned === 0 && dept.totalNotScanned === 0 && dept.totalPerson === 0;

                  let rowBgClass = '';
                  if (dept.isTotalRow) {
                    if (totalRowLevel === 1) {
                      rowBgClass = 'bg-yellow-300 font-bold';
                    } else if (totalRowLevel === 2) {
                      rowBgClass = 'bg-blue-300 font-bold';
                    } else if (totalRowLevel === 3) {
                      rowBgClass = 'bg-green-200 font-bold';
                    }
                  } else {
                    rowBgClass = levelColors[deptLevel - 1] || 'bg-white';
                  }

                  const verticalPaddingClass = (deptLevel === 1 || deptLevel === 2 || dept.isTotalRow) ? 'py-3' : 'py-2';
                  const displayedDeptCode = dept.isTotalRow ? '' : dept.deptcode;
                  const displaySBU = dept.isTotalRow || deptLevel === 1 || deptLevel === 2 ? '' : dept.deptsbu;
                  const displaySTD = dept.isTotalRow || deptLevel === 1 || deptLevel === 2 ? '' : dept.deptstd;
                  const formatNumber = (value: number, currentDeptLevel: number, isTotalRow: boolean, allValuesAreZero: boolean) => {
                    if (isTotalRow || currentDeptLevel === 1 || currentDeptLevel === 2 || currentDeptLevel === 3) {
                      return value.toString(); 
                    } else {
                      return (value === 0 && allValuesAreZero) ? '' : value.toString();
                    }
                  };
                  const displayedTotalScanned = formatNumber(dept.totalScanned, deptLevel, !!dept.isTotalRow, allZeroValues);
                  const displayedTotalNotScanned = formatNumber(dept.totalNotScanned, deptLevel, !!dept.isTotalRow, allZeroValues);
                  const displayedTotalPerson = formatNumber(dept.totalPerson, deptLevel, !!dept.isTotalRow, allZeroValues);
                  const shouldHideIcon = dept.isTotalRow || allZeroValues;

                  const handleLinkClick = () => {
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('prevDashboardDate', linkWorkdate);
                    }
                  };

                  return (
                    <tr
                      key={`${dept.workdate}-${dept.deptcode}-${index}`}
                      className={`${rowBgClass} border-b border-gray-100 last:border-b-0`}
                    >
                      <td className={`px-6 ${verticalPaddingClass}`}>
                        {dept.isTotalRow ? '' : dept.workdate}
                      </td>
                      <td className={`px-6 ${verticalPaddingClass}`}>{displayedDeptCode}</td>
                      <td
                        className={`px-6 text-left ${verticalPaddingClass}`}
                        style={{ paddingLeft: `${paddingLeft}px` }}
                      >
                        {dept.deptname}
                      </td>
                      <td className={`px-5 ${verticalPaddingClass}`}>{displaySBU}</td>
                      <td className={`px-6 ${verticalPaddingClass}`}>{displaySTD}</td>

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
                          <Link
                            href={`/report/${encodeURIComponent(linkDeptcode)}?workdate=${encodeURIComponent(linkWorkdate)}`}
                            onClick={handleLinkClick}
                            passHref
                          >
                            <PiFileMagnifyingGlassBold size={30} className="text-blue-500 hover:text-blue-700" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {hasMore && (
        <div ref={loadMoreRef} className="py-4 text-center text-gray-400 bg-white rounded-xl shadow mt-4">
          กำลังโหลดข้อมูลเพิ่ม...
        </div>
      )}

      {showBackToTop && (
        <button
          onClick={handleBackToTop}
          className="fixed bottom-8 right-8 z-50 bg-[#16aaff] rounded-full shadow-lg p-0 w-16 h-16 flex items-center justify-center hover:bg-blue-500 transition"
          aria-label="Back to top"
          type="button"
        >
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
            <circle cx="19" cy="19" r="19" fill="#16aaff"/>
            <path d="M11 22L19 15L27 22" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
    </div>
  );
}