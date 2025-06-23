'use client';

import React, { useRef, useEffect, useMemo } from 'react';
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
  const level2 = dept.deptcodelevel2;
  const level3 = dept.deptcodelevel3;
  const level4 = dept.deptcodelevel4;

  if (level2.endsWith('000000')) { 
    return 1;
  }
  if (level3.endsWith('0000')) { 
    return 2;
  }
  if (level4.endsWith('00')) { 
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

export function DepartmentTable({ employees, scanStatus = 'all', onLoadMore, hasMore}: DepartmentTableProps) {
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

      const updateParentTotals = (
        parentCode: string, 
        parentName: string, 
        level1: string, 
        level2: string, 
        level3: string, 
        level4: string
      ) => {
        const parentGroupKey = `${emp.workdate}-${parentCode}`;
        let parentDept = departmentsMap.get(parentGroupKey);
        if (!parentDept) {
          parentDept = {
            deptcode: parentCode,
            deptname: parentName,
            deptsbu: '', 
            deptstd: null,
            totalScanned: 0,
            totalNotScanned: 0,
            totalPerson: 0,
            deptcodelevel1: level1,
            deptcodelevel2: level2,
            deptcodelevel3: level3,
            deptcodelevel4: level4,
            workdate: emp.workdate,
            isTotalRow: false, 
          };
          departmentsMap.set(parentGroupKey, parentDept);
        }
        parentDept.totalScanned += Number(emp.countscan);
        parentDept.totalNotScanned += Number(emp.countnotscan);
        parentDept.totalPerson += Number(emp.countperson);
      };
      if (getDeptLevel(currentDept) === 4) { 
        updateParentTotals(deptcodelevel3, `รวมแผนก ${deptcodelevel3.substring(0, 6)}`, deptcodelevel1, deptcodelevel2, deptcodelevel3, deptcodelevel3);
      }
      if (getDeptLevel(currentDept) >= 3) { 
        updateParentTotals(deptcodelevel2, `รวมฝ่าย ${deptcodelevel2.substring(0, 4)}`, deptcodelevel1, deptcodelevel2, deptcodelevel2, deptcodelevel2);
      }
      if (getDeptLevel(currentDept) >= 2) { 
        updateParentTotals(deptcodelevel1, `รวมโรงงาน ${deptcodelevel1.substring(0, 2)}`, deptcodelevel1, deptcodelevel1, deptcodelevel1, deptcodelevel1);
      }
    });
    const hierarchicalMap = new Map<string, { dept: AggregatedDepartment; children: AggregatedDepartment[] }>();
    departmentsMap.forEach(dept => {
      hierarchicalMap.set(`${dept.workdate}-${dept.deptcode}`, { dept, children: [] });
    });
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
        const entry = hierarchicalMap.get(`${dept.workdate}-${dept.deptcode}`);
        if (!entry) return;
        finalDisplayList.push({ ...entry.dept, isTotalRow: false });
        entry.children.forEach(child => flattenAndAddTotals(child));
        const deptLevel = getDeptLevel(entry.dept);
        if (deptLevel === 1 || deptLevel === 2) {
            let totalDeptName = '';
            if (deptLevel === 1) {
                totalDeptName = `Grand Total ${entry.dept.deptname.replace('รวมโรงงาน ', '')}`;
            } else if (deptLevel === 2) {
                totalDeptName = `Total ${entry.dept.deptname.replace('รวมฝ่าย ', '')}`;
            }
            finalDisplayList.push({
                ...entry.dept,
                deptname: totalDeptName,
                deptcode: 'TOTAL_${entry.dept.deptcode}',
                isTotalRow: true,
                deptsbu: '',
                deptstd: null,
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
                  const paddingLeft = dept.isTotalRow ? 0 : (deptLevel - 1) * 25;


                  let rowBgClass = '';
                  if (dept.isTotalRow) {
                    if (deptLevel === 1) {
                      rowBgClass = 'bg-yellow-300 font-bold'; 
                    } else if (deptLevel === 2) {
                      rowBgClass = 'bg-blue-300 font-bold';
                    }
                  } else {
                    rowBgClass = levelColors[deptLevel - 1] || 'bg-white';
                  }

                  const verticalPaddingClass = (deptLevel === 1 || deptLevel === 2 || dept.isTotalRow) ? 'py-3' : 'py-2';
                  const hasNonZeroValue = dept.totalScanned !== 0 || dept.totalNotScanned !== 0 || dept.totalPerson !== 0;
                  const displayedDeptCode = dept.isTotalRow ? '' : dept.deptcode;
                  const displaySBU = dept.isTotalRow || deptLevel === 2 ? '' : dept.deptsbu;
                  const displaySTD = dept.isTotalRow || deptLevel === 2 ? '' : dept.deptstd;

                  let displayedTotalScanned = '';
                  let displayedTotalNotScanned = '';
                  let displayedTotalPerson = '';

                  if (dept.isTotalRow || deptLevel >= 3) {
                    displayedTotalScanned = dept.totalScanned.toString();
                    displayedTotalNotScanned = dept.totalNotScanned.toString();
                    displayedTotalPerson = dept.totalPerson.toString();
                  }

                  const shouldHideIcon = dept.isTotalRow || (deptLevel < 4 && !hasNonZeroValue);

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
    </div>
  );
}