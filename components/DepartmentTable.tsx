// components/DepartmentTable.tsx
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
  levelCodeToNameMap: Map<string, string>;
  // filters: { // Removed filters prop
  //   from: string;
  //   to: string;
  //   factoryId: string;
  //   mainDepartmentId: string;
  //   subDepartmentId: string;
  //   employeeId: string;
  // };
};

export function DepartmentTable({ employees, scanStatus = 'all', onLoadMore, hasMore, levelCodeToNameMap }: DepartmentTableProps) { // Removed filters from destructuring
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined' && window.scrollY > 200) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const handleBackToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };


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
          deptname: levelCodeToNameMap.get(fullDeptCode) || emp.deptname,
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
        parentCodeFull: string,
        parentCodeShort: string
      ) => {
        const parentGroupKey = `${emp.workdate}-${parentCodeFull}`;
        let parentDept = departmentsMap.get(parentGroupKey);
        if (!parentDept) {
          parentDept = {
            deptcode: parentCodeFull,
            deptname: levelCodeToNameMap.get(parentCodeShort) || `รวม ${parentCodeShort}`,
            deptsbu: '',
            deptstd: null,
            totalScanned: 0,
            totalNotScanned: 0,
            totalPerson: 0,
            deptcodelevel1: parentCodeFull.substring(0,2) + '000000',
            deptcodelevel2: parentCodeFull.substring(0,4) + '0000',
            deptcodelevel3: parentCodeFull.substring(0,6) + '00',
            deptcodelevel4: parentCodeFull,
            workdate: emp.workdate,
            isTotalRow: false,
          };
          departmentsMap.set(parentGroupKey, parentDept);
        }
        parentDept.totalScanned += Number(emp.countscan);
        parentDept.totalNotScanned += Number(emp.countnotscan);
        parentDept.totalPerson += Number(emp.countperson);
      };

      const currentDeptLevel = getDeptLevel(currentDept);

      if (currentDeptLevel === 4) {
        updateParentTotals(deptcodelevel3, deptcodelevel3.substring(0,6));
      }
      if (currentDeptLevel >= 3) {
        updateParentTotals(deptcodelevel2, deptcodelevel2.substring(0,4));
      }
      if (currentDeptLevel >= 2) {
        updateParentTotals(deptcodelevel1, deptcodelevel1.substring(0,2));
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

      if (dept.isTotalRow) {
          topLevelDepartments.push(dept);
          return;
      }

      const parentEntryKey = parentCode ? `${dept.workdate}-${parentCode}` : null;

      if (parentEntryKey && hierarchicalMap.has(parentEntryKey) && parentEntryKey !== `${dept.workdate}-${dept.deptcode}`) {
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
        const currentDeptCodeForTotal = entry.dept.deptcode;

        if (deptLevel === 1 || deptLevel === 2 || deptLevel === 3) {
            // Condition to hide green total rows for ANY level 3 department without children
            if (deptLevel === 3 && entry.children.length === 0) {
                // Skip pushing this total row if it's a level 3 department with no children
                return;
            }

            let totalDeptName = '';
            let totalDeptCodeShort = '';

            if (deptLevel === 1) {
                totalDeptCodeShort = currentDeptCodeForTotal.substring(0, 2);
                totalDeptName = `Grand Total ${levelCodeToNameMap.get(totalDeptCodeShort) || totalDeptCodeShort}`;
            } else if (deptLevel === 2) {
                totalDeptCodeShort = currentDeptCodeForTotal.substring(0, 4);
                totalDeptName = `Total ${levelCodeToNameMap.get(totalDeptCodeShort) || totalDeptCodeShort}`;
            } else if (deptLevel === 3) {
                totalDeptCodeShort = currentDeptCodeForTotal.substring(0, 6);
                totalDeptName = `Total ${levelCodeToNameMap.get(totalDeptCodeShort) || totalDeptCodeShort}`;
            }

            finalDisplayList.push({
                ...entry.dept,
                deptname: totalDeptName,
                deptcode: `TOTAL_${currentDeptCodeForTotal}`,
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

    topLevelDepartments
      .filter(dept => !dept.isTotalRow)
      .forEach(dept => flattenAndAddTotals(dept));

    return finalDisplayList;
  }, [employees, levelCodeToNameMap]);

  const filteredDepartments = useMemo(() => {
    return aggregatedDepartments.filter(dept => {
        const allZeroValues = dept.totalScanned === 0 && dept.totalNotScanned === 0 && dept.totalPerson === 0;

        // If it's a total row and all values are zero, always hide it
        if (dept.isTotalRow && allZeroValues) {
            return false;
        }

        // Apply scanStatus filter only to non-total rows
        if (!dept.isTotalRow) {
            if (scanStatus === 'scanned') {
                return dept.totalScanned > 0;
            }
            if (scanStatus === 'not_scanned') {
                return dept.totalNotScanned > 0;
            }
        }
        return true;
    });
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

                  let effectiveDeptLevel = deptLevel;
                  if (dept.isTotalRow && dept.deptcode.startsWith('TOTAL_')) {
                    const originalDeptCode = dept.deptcode.replace('TOTAL_', '');
                    effectiveDeptLevel = getDeptLevel({ ...dept, deptcode: originalDeptCode });
                  }


                  const paddingLeft = dept.isTotalRow ? 0 : (effectiveDeptLevel - 1) * 25;

                  const allZeroValues = dept.totalScanned === 0 && dept.totalNotScanned === 0 && dept.totalPerson === 0;

                  let rowBgClass = '';
                  if (dept.isTotalRow) {
                    if (effectiveDeptLevel === 1) {
                      rowBgClass = 'bg-yellow-300 font-bold';
                    } else if (effectiveDeptLevel === 2) {
                      rowBgClass = 'bg-blue-300 font-bold';
                    } else if (effectiveDeptLevel === 3) {
                      rowBgClass = 'bg-green-200 font-bold';
                    } else {
                        rowBgClass = 'bg-gray-300 font-bold';
                    }
                  } else {
                    rowBgClass = levelColors[effectiveDeptLevel - 1] || 'bg-white';
                  }


                  const verticalPaddingClass = (effectiveDeptLevel === 1 || effectiveDeptLevel === 2 || dept.isTotalRow) ? 'py-3' : 'py-2';
                  const displayedDeptCode = dept.isTotalRow ? '' : dept.deptcode;
                  const displaySBU = dept.isTotalRow || effectiveDeptLevel === 2 ? '' : dept.deptsbu;
                  const displaySTD = dept.isTotalRow || effectiveDeptLevel === 2 ? '' : dept.deptstd;

                  let displayedTotalScanned = '';
                  let displayedTotalNotScanned = '';
                  let displayedTotalPerson = '';

                  if (dept.isTotalRow || effectiveDeptLevel >= 3) {
                    displayedTotalScanned = dept.totalScanned.toString();
                    displayedTotalNotScanned = dept.totalNotScanned.toString();
                    displayedTotalPerson = dept.totalPerson.toString();
                  }

                  // Modified: The icon should be hidden if:
                  // 1. It's a total row (dept.isTotalRow)
                  // OR
                  // 2. It's a Level 1 or Level 2 department (effectiveDeptLevel === 1 || effectiveDeptLevel === 2)
                  // OR
                  // 3. It's a Level 3 department AND all Scan/No Scan/Person values are zero (effectiveDeptLevel === 3 && allZeroValues)
                  const shouldHideIcon = dept.isTotalRow || effectiveDeptLevel === 1 || effectiveDeptLevel === 2 || (effectiveDeptLevel === 3 && allZeroValues);

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