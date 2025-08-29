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

export type AggregatedDepartment = {
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
  isTotalRow?: boolean;
  isGrandTotal?: boolean;
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
  return 4;
};

export function ManpowerTable({ selectedDate, scanStatus, deptcodelevel1Filter }: ManpowerTableProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/department?date=${selectedDate}`);
        if (!response.ok) {
          throw new Error('Failed to fetch employees');
        }
        const data: Employee[] = await response.json();
        setEmployees(data);
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

    if (selectedDate) {
      fetchEmployees();
    }
  }, [selectedDate]);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getAllDescendantCodes = (dept: AggregatedDepartment, allEmployees: Employee[]): string[] => {
    const level = getDeptLevel(dept);
    if (level === 4) {
      return [dept.deptcode];
    }

    const uniqueCodes = new Set<string>();

    const baseCode = dept.deptcodelevel1 + (dept.deptcodelevel2 !== '00' ? dept.deptcodelevel2 : '') +
      (dept.deptcodelevel3 !== '00' ? dept.deptcodelevel3 : '');

    allEmployees
      .filter(emp => emp.deptcode.startsWith(baseCode))
      .forEach(emp => {
        if (emp.deptcodelevel4 !== '00') {
          uniqueCodes.add(emp.deptcode);
        } else if (emp.deptcodelevel3 !== '00' && emp.deptcodelevel4 === '00') {
          uniqueCodes.add(emp.deptcode);
        }
      });

    return Array.from(uniqueCodes);
  };

  const aggregatedDepartments = useMemo(() => {
    const departmentsMap = new Map<string, AggregatedDepartment>();
    const hierarchicalMap = new Map<string, { dept: AggregatedDepartment; children: AggregatedDepartment[] }>();

    employees.forEach(emp => {
      if (deptcodelevel1Filter && emp.deptcodelevel1 !== deptcodelevel1Filter) {
        return;
      }

      const parsedScan = Number(emp.countscan);
      const parsedNotScan = Number(emp.countnotscan);
      const parsedPerson = Number(emp.countperson);

      let currentDept = departmentsMap.get(emp.deptcode);
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
          isTotalRow: false,
          isGrandTotal: false,
        };
        departmentsMap.set(emp.deptcode, currentDept);
      }
      currentDept.totalScanned += parsedScan;
      currentDept.totalNotScanned += parsedNotScan;
      currentDept.totalPerson += parsedPerson;

      const ensureParentDeptExists = (code: string, level1: string, level2: string, level3: string, level4: string, namePrefix: string) => {
        if (!departmentsMap.has(code)) {
          const existingEmp = employees.find(e => e.deptcode === code);
          departmentsMap.set(code, {
            deptcode: code,
            deptname: existingEmp?.deptname || `${namePrefix} ${code}`,
            deptsbu: existingEmp?.deptsbu || '',
            deptstd: existingEmp?.deptstd || '',
            totalScanned: 0,
            totalNotScanned: 0,
            totalPerson: 0,
            deptcodelevel1: level1,
            deptcodelevel2: level2,
            deptcodelevel3: level3,
            deptcodelevel4: level4,
            isTotalRow: false,
            isGrandTotal: false,
          });
        }
      };

      if (emp.deptcodelevel4 !== '00') {
        const level3ParentCode = emp.deptcodelevel1 + emp.deptcodelevel2 + emp.deptcodelevel3 + '00';
        ensureParentDeptExists(level3ParentCode, emp.deptcodelevel1, emp.deptcodelevel2, emp.deptcodelevel3, '00', 'รวมแผนก');
      }
      if (emp.deptcodelevel3 !== '00') {
        const level2ParentCode = emp.deptcodelevel1 + emp.deptcodelevel2 + '0000';
        ensureParentDeptExists(level2ParentCode, emp.deptcodelevel1, emp.deptcodelevel2, '00', '00', 'รวมฝ่าย');
      }
      if (emp.deptcodelevel2 !== '00') {
        const level1ParentCode = emp.deptcodelevel1 + '000000';
        ensureParentDeptExists(level1ParentCode, emp.deptcodelevel1, '00', '00', '00', 'รวมโรงงาน');
      }
    });

    departmentsMap.forEach(dept => {
      hierarchicalMap.set(dept.deptcode, { dept, children: [] });
    });

    // ฟังก์ชันใหม่สำหรับการรวมผลรวม รวมถึง SBU และ STD
    const calculateTotalsIncludingChildren = (deptCode: string): { scanned: number; notScanned: number; person: number; sbu: number; std: number; } => {
      const entry = hierarchicalMap.get(deptCode);
      if (!entry) {
        return { scanned: 0, notScanned: 0, person: 0, sbu: 0, std: 0 };
      }

      let totalScanned = entry.dept.totalScanned;
      let totalNotScanned = entry.dept.totalNotScanned;
      let totalPerson = entry.dept.totalPerson;

      // แปลง SBU และ STD เป็นตัวเลขเพื่อคำนวณ โดยใช้หลักสุดท้าย
      const sbuNumber = Number(entry.dept.deptsbu.slice(-3));
      const stdNumber = Number(entry.dept.deptstd.slice(-3));
      let totalSbu = isNaN(sbuNumber) ? 0 : sbuNumber;
      let totalStd = isNaN(stdNumber) ? 0 : stdNumber;

      entry.children.forEach(childDept => {
        const childTotals = calculateTotalsIncludingChildren(childDept.deptcode);
        totalScanned += childTotals.scanned;
        totalNotScanned += childTotals.notScanned;
        totalPerson += childTotals.person;
        totalSbu += childTotals.sbu;
        totalStd += childTotals.std;
      });

      return { scanned: totalScanned, notScanned: totalNotScanned, person: totalPerson, sbu: totalSbu, std: totalStd };
    };

    const topLevelDepartments: AggregatedDepartment[] = [];
    const allDepartmentsSortedByCode = Array.from(departmentsMap.values()).sort((a, b) => a.deptcode.localeCompare(b.deptcode));

    allDepartmentsSortedByCode.forEach(dept => {
      const level = getDeptLevel(dept);
      let parentCode: string | null = null;

      if (level === 4) {
        parentCode = dept.deptcodelevel1 + dept.deptcodelevel2 + dept.deptcodelevel3 + '00';
      } else if (level === 3) {
        parentCode = dept.deptcodelevel1 + dept.deptcodelevel2 + '0000';
      } else if (level === 2) {
        parentCode = dept.deptcodelevel1 + '000000';
      }

      if (parentCode && hierarchicalMap.has(parentCode)) {
        const parentEntry = hierarchicalMap.get(parentCode);
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
      const entry = hierarchicalMap.get(dept.deptcode);
      if (!entry) return;

      const deptLevel = getDeptLevel(entry.dept);

      finalDisplayList.push({ ...entry.dept, isTotalRow: false, isGrandTotal: false });

      entry.children.forEach(child => flattenAndAddTotals(child));

      if (deptLevel === 1 || deptLevel === 2 || (deptLevel === 3 && entry.children.length > 0)) {
        const totalDeptName =
          deptLevel === 1
            ? `Grand Total ${entry.dept.deptname.replace('รวมโรงงาน ', '')}`
            : deptLevel === 2
              ? `Total ${entry.dept.deptname.replace('รวมฝ่าย ', '')}`
              : deptLevel === 3
                ? `Total ${entry.dept.deptname.replace('รวมแผนก ', '')}`
                : `Total ${entry.dept.deptname}`;
        const totalDeptCode = `TOTAL_${entry.dept.deptcode}`;

        const aggregatedTotalsForCurrentNode = calculateTotalsIncludingChildren(entry.dept.deptcode);

        finalDisplayList.push({
          ...entry.dept,
          deptname: totalDeptName,
          deptcode: totalDeptCode,
          isTotalRow: true,
          isGrandTotal: false,
          totalScanned: aggregatedTotalsForCurrentNode.scanned,
          totalNotScanned: aggregatedTotalsForCurrentNode.notScanned,
          totalPerson: aggregatedTotalsForCurrentNode.person,
          deptsbu: String(aggregatedTotalsForCurrentNode.sbu),
          deptstd: String(aggregatedTotalsForCurrentNode.std),
        });
      }
    };

    topLevelDepartments.sort((a, b) => a.deptcode.localeCompare(b.deptcode));

    topLevelDepartments.forEach(dept => flattenAndAddTotals(dept));

    if (topLevelDepartments.length > 1) {
      const totalCountsFromTopLevels = topLevelDepartments.reduce(
        (acc, dept) => {
          const totals = calculateTotalsIncludingChildren(dept.deptcode);
          acc.scanned += totals.scanned;
          acc.notScanned += totals.notScanned;
          acc.person += totals.person;
          acc.sbu += totals.sbu;
          acc.std += totals.std;
          return acc;
        },
        { scanned: 0, notScanned: 0, person: 0, sbu: 0, std: 0 }
      );

      finalDisplayList.push({
        deptcode: 'GRAND_TOTAL',
        deptname: 'All Haier',
        deptsbu: String(totalCountsFromTopLevels.sbu),
        deptstd: String(totalCountsFromTopLevels.std),
        totalScanned: totalCountsFromTopLevels.scanned,
        totalNotScanned: totalCountsFromTopLevels.notScanned,
        totalPerson: totalCountsFromTopLevels.person,
        deptcodelevel1: '',
        deptcodelevel2: '',
        deptcodelevel3: '',
        deptcodelevel4: '',
        isTotalRow: true,
        isGrandTotal: true,
      });
    }

    return finalDisplayList;
  }, [employees, deptcodelevel1Filter]);

  const filteredDepartments = useMemo(() => {
    if (scanStatus === 'scanned') {
      return aggregatedDepartments.filter(dept => dept.totalScanned > 0 || dept.isTotalRow);
    }
    if (scanStatus === 'not_scanned') {
      return aggregatedDepartments.filter(dept => dept.totalNotScanned > 0 || dept.isTotalRow);
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
  //สีของแต่ละ Level
  const levelColors = [
    'bg-blue-200',     // Level 1: โรงงาน
    'bg-blue-100',     // Level 2: ฝ่าย
    'bg-blue-50',      // Level 3: แผนก
    'bg-white',      // Level 4: หน่วยงานย่อย
  ];

  return (
    <div className="overflow-x-auto bg-gray-50 rounded-xl shadow-lg p-7">
      <table className="min-w-full text-sm text-center border-collapse ">
        <thead className="border border-blue-500 rounded-md text-white bg-blue-800 ">
          <tr>
            <th className="py-2 px-6">Deptcode</th>
            <th className="py-2 px-6 ">Deptname</th>
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
          {filteredDepartments.map((dept) => {
            const deptLevel = getDeptLevel(dept);
            const paddingLeft = (deptLevel - 1) * 25;

            let rowBgClass = '';
            if (dept.isGrandTotal) {
              rowBgClass = 'bg-red-300 font-extrabold';
            }
            else if (dept.isTotalRow) {
              if (deptLevel === 1) {
                rowBgClass = 'bg-yellow-300 font-bold';
              }
              else if (deptLevel === 2) {
                rowBgClass = 'bg-blue-300 font-bold';
              }
              else if (deptLevel === 3) {
                rowBgClass = 'bg-green-200 font-bold';
              }
            } else {
              rowBgClass = levelColors[deptLevel - 1] || 'bg-white';
            }

            const verticalPaddingClass = (deptLevel === 1 || deptLevel === 2 || dept.isTotalRow) ? 'py-3' : 'py-2';

            // แก้ไข: ตรวจสอบและแสดงผลเป็นค่าว่างถ้าเป็น NaN หรือ undefined
            const displaySBU = dept.isTotalRow ? Number(dept.deptsbu).toLocaleString() : dept.deptsbu;
            const displaySTD = dept.isTotalRow ? Number(dept.deptstd).toLocaleString() : dept.deptstd;

            const displayedTotalScanned = dept.totalScanned.toLocaleString();
            const displayedTotalNotScanned = dept.totalNotScanned.toLocaleString();
            const displayedTotalPerson = dept.totalPerson.toLocaleString();

            const handleLinkClick = () => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('prevDashboardDate', selectedDate);
              }
            };

            let href = '';
            if (dept.isTotalRow && !dept.isGrandTotal) {
              const descendantCodes = getAllDescendantCodes(dept, employees);
              const deptcodes = descendantCodes.join(',');
              href = `/report/details?deptcodes=${deptcodes}&workdate=${selectedDate}`;
            } else if (!dept.isTotalRow) {
              const linkDeptcode = dept.deptcode.replace('TOTAL_', '');
              const linkWorkdate = selectedDate;
              href = `/report/details?deptcodes=${linkDeptcode}&workdate=${linkWorkdate}`;
            }

            return (
              <tr key={dept.deptcode} className={`${rowBgClass} border-b border-gray-100 last:border-b-0`}>
                <td className={`px-6 ${verticalPaddingClass}`}>
                  {dept.isTotalRow ? '' : dept.deptcode}
                </td>
                <td className={`px-6 text-left ${verticalPaddingClass}`} style={{ paddingLeft: `${paddingLeft}px` }}>
                  {dept.deptname}
                </td>
                <td className={`px-5 ${verticalPaddingClass}`}>
                  {displaySBU}
                </td>
                <td className={`px-6 ${verticalPaddingClass}`}>
                  {displaySTD}
                </td>
                {scanStatus !== 'not_scanned' && (
                  <td className={`px-6 ${verticalPaddingClass}`}>{displayedTotalScanned}</td>
                )}
                {scanStatus !== 'scanned' && (
                  <td className={`px-6 ${verticalPaddingClass}`}>{displayedTotalNotScanned}</td>
                )}
                <td className={`px-6 ${verticalPaddingClass}`}>{displayedTotalPerson}</td>
                <td className={`p-3 ${verticalPaddingClass}`}>
                  {dept.isGrandTotal ? null : (
                    <Link href={href} onClick={handleLinkClick}>
                      <PiFileMagnifyingGlassBold size={30} className="text-blue-500 hover:text-blue-700" />
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {showBackToTop && (
        <button
          onClick={handleBackToTop}
          className="fixed bottom-8 right-8 z-50 bg-[#16aaff] rounded-full shadow-lg p-0 w-16 h-16 flex items-center justify-center hover:bg-blue-500 transition"
          aria-label="Back to top"
        >
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
            <circle cx="19" cy="19" r="19" fill="#16aaff" />
            <path d="M11 22L19 15L27 22" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}