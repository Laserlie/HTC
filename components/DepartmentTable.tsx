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

  sumSbuEndNum?: number;
  sumStdEndNum?: number;
};

const getDeptLevel = (dept: AggregatedDepartment): number => {
  // ตรวจสอบระดับที่ 4 (หน่วยงานย่อย)
  if (dept.deptcode.substring(6, 8) !== '00') {
    return 4;
  }
  // ตรวจสอบระดับที่ 3 (แผนก)
  if (dept.deptcode.substring(4, 8) !== '0000') {
    return 3;
  }
  // ตรวจสอบระดับที่ 2 (ฝ่าย)
  if (dept.deptcode.substring(2, 8) !== '000000') {
    return 2;
  }
  // ถ้าไม่ตรงเงื่อนไขข้างต้น แสดงว่าเป็นระดับ 1 (โรงงาน)
  return 1;
};

export type DepartmentTableProps = {
  employees: Employee[];
  scanStatus?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  levelCodeToNameMap: Map<string, string>;
};

export function DepartmentTable({ employees, scanStatus = 'all', onLoadMore, hasMore, levelCodeToNameMap }: DepartmentTableProps) {
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
    // 1. สร้าง departmentsMap เฉพาะจาก employees (ไม่บวกค่าจากลูก)
    const departmentsMap = new Map<string, AggregatedDepartment>();
    employees.forEach(emp => {
      const fullDeptCode = emp.originalFullDeptcode || emp.deptcode || '';
      const deptcodelevel1 = fullDeptCode.substring(0, 2) + '000000';
      const deptcodelevel2 = fullDeptCode.substring(0, 4) + '0000';
      const deptcodelevel3 = fullDeptCode.substring(0, 6) + '00';
      const deptcodelevel4 = fullDeptCode.substring(0, 8);
      const groupKey = `${emp.workdate}-${fullDeptCode}`;
      if (!departmentsMap.has(groupKey)) {
        departmentsMap.set(groupKey, {
          deptcode: fullDeptCode,
          deptname: levelCodeToNameMap.get(fullDeptCode) || emp.deptname,
          deptsbu: emp.deptsbu,
          deptstd: emp.deptstd,
          totalScanned: Number(emp.countscan),
          totalNotScanned: Number(emp.countnotscan),
          totalPerson: Number(emp.countperson),
          deptcodelevel1,
          deptcodelevel2,
          deptcodelevel3,
          deptcodelevel4,
          workdate: emp.workdate,
          isTotalRow: false,
          
          sumSbuEndNum: Number(emp.deptsbu.slice(-1)) || 0,
          sumStdEndNum: emp.deptstd ? Number(emp.deptstd.slice(-1)) || 0 : 0,
        });
      } else {
        const dept = departmentsMap.get(groupKey)!;
        dept.totalScanned += Number(emp.countscan);
        dept.totalNotScanned += Number(emp.countnotscan);
        dept.totalPerson += Number(emp.countperson);
        
        dept.sumSbuEndNum! += Number(emp.deptsbu.slice(-1)) || 0;
        if (emp.deptstd) {
          dept.sumStdEndNum! += Number(emp.deptstd.slice(-1)) || 0;
        }
      }
    });

    // 2. สร้าง parent node เฉยๆ (ไม่บวกค่าจากลูก)
    const addParentNode = (workdate: string, parentCode: string, name: string) => {
      const key = `${workdate}-${parentCode}`;
      if (!departmentsMap.has(key)) {
        departmentsMap.set(key, {
          deptcode: parentCode,
          deptname: name,
          deptsbu: '',
          deptstd: null,
          totalScanned: 0,
          totalNotScanned: 0,
          totalPerson: 0,
          deptcodelevel1: parentCode.substring(0, 2) + '000000',
          deptcodelevel2: parentCode.substring(0, 4) + '0000',
          deptcodelevel3: parentCode.substring(0, 6) + '00',
          deptcodelevel4: parentCode,
          workdate,
          isTotalRow: false,
          // ✅ สร้างฟิลด์ผลรวมเริ่มต้นเป็น 0
          sumSbuEndNum: 0,
          sumStdEndNum: 0,
        });
      }
    };

    Array.from(departmentsMap.values()).forEach(dept => {
      const level = getDeptLevel(dept);
      if (level === 4) {
        addParentNode(dept.workdate, dept.deptcodelevel3, levelCodeToNameMap.get(dept.deptcodelevel3) || 'รวมแผนก');
      }
      if (level >= 3) {
        addParentNode(dept.workdate, dept.deptcodelevel2, levelCodeToNameMap.get(dept.deptcodelevel2) || 'รวมฝ่าย');
      }
      if (level >= 2) {
        addParentNode(dept.workdate, dept.deptcodelevel1, levelCodeToNameMap.get(dept.deptcodelevel1) || 'รวมโรงงาน');
      }
    });

    // 3. สร้าง hierarchicalMap
    const hierarchicalMap = new Map<string, { dept: AggregatedDepartment; children: AggregatedDepartment[] }>();
    departmentsMap.forEach(dept => {
      hierarchicalMap.set(`${dept.workdate}-${dept.deptcode}`, { dept, children: [] });
    });

    // 4. สร้าง parent-child relationship
    Array.from(departmentsMap.values()).forEach(dept => {
      const level = getDeptLevel(dept);
      let parentCode: string | null = null;
      if (level === 4) parentCode = dept.deptcodelevel3;
      else if (level === 3) parentCode = dept.deptcodelevel2;
      else if (level === 2) parentCode = dept.deptcodelevel1;
      const parentEntryKey = parentCode ? `${dept.workdate}-${parentCode}` : null;
      if (parentEntryKey && hierarchicalMap.has(parentEntryKey) && parentEntryKey !== `${dept.workdate}-${dept.deptcode}`) {
        hierarchicalMap.get(parentEntryKey)!.children.push(dept);
      }
    });

    // 5. สร้าง topLevelDepartments
    const topLevelDepartments: AggregatedDepartment[] = [];
    Array.from(departmentsMap.values()).forEach(dept => {
      const level = getDeptLevel(dept);
      if (level === 1) topLevelDepartments.push(dept);
    });

    
    const calculateTotalsIncludingChildren = (deptKey: string): { scanned: number; notScanned: number; person: number; sumSbuEndNum: number; sumStdEndNum: number } => {
      const entry = hierarchicalMap.get(deptKey);
      if (!entry) return { scanned: 0, notScanned: 0, person: 0, sumSbuEndNum: 0, sumStdEndNum: 0 };
      let totalScanned = entry.dept.totalScanned;
      let totalNotScanned = entry.dept.totalNotScanned;
      let totalPerson = entry.dept.totalPerson;
      
      let totalSbuEndNum = entry.dept.sumSbuEndNum || 0;
      let totalStdEndNum = entry.dept.sumStdEndNum || 0;

      entry.children.forEach(child => {
        const childTotals = calculateTotalsIncludingChildren(`${child.workdate}-${child.deptcode}`);
        totalScanned += childTotals.scanned;
        totalNotScanned += childTotals.notScanned;
        totalPerson += childTotals.person;
      
        totalSbuEndNum += childTotals.sumSbuEndNum;
        totalStdEndNum += childTotals.sumStdEndNum;
      });
      return { scanned: totalScanned, notScanned: totalNotScanned, person: totalPerson, sumSbuEndNum: totalSbuEndNum, sumStdEndNum: totalStdEndNum };
    };

    // 7. flattenAndAddTotals แบบ ManpowerTable
    const finalDisplayList: AggregatedDepartment[] = [];
    const flattenAndAddTotals = (dept: AggregatedDepartment) => {
      const entry = hierarchicalMap.get(`${dept.workdate}-${dept.deptcode}`);
      if (!entry) return;
      finalDisplayList.push({ ...entry.dept, isTotalRow: false });
      entry.children.forEach(child => flattenAndAddTotals(child));
      const deptLevel = getDeptLevel(entry.dept);
      if (deptLevel === 1 || deptLevel === 2 || (deptLevel === 3 && entry.children.length > 0)) {
        let totalDeptName = '';
        if (deptLevel === 1) {
          totalDeptName = `Grand Total ${entry.dept.deptname.replace('รวมโรงงาน ', '')}`;
        } else if (deptLevel === 2) {
          totalDeptName = `Total ${entry.dept.deptname.replace('รวมฝ่าย ', '')}`;
        } else if (deptLevel === 3) {
          totalDeptName = `Total ${entry.dept.deptname.replace('รวมแผนก ', '')}`;
        }
        const aggregatedTotalsForCurrentNode = calculateTotalsIncludingChildren(`${entry.dept.workdate}-${entry.dept.deptcode}`);
        finalDisplayList.push({
          ...entry.dept,
          deptname: totalDeptName,
          deptcode: `TOTAL_${entry.dept.deptcode}`,
          isTotalRow: true,
          deptsbu: '',
          deptstd: null,
          totalScanned: aggregatedTotalsForCurrentNode.scanned,
          totalNotScanned: aggregatedTotalsForCurrentNode.notScanned,
          totalPerson: aggregatedTotalsForCurrentNode.person,
          // ✅ กำหนดค่าจากตัวเลขที่รวมแล้ว
          sumSbuEndNum: aggregatedTotalsForCurrentNode.sumSbuEndNum,
          sumStdEndNum: aggregatedTotalsForCurrentNode.sumStdEndNum,
        });
      }
    };
    topLevelDepartments.sort((a, b) => {
      if (a.workdate !== b.workdate) return a.workdate.localeCompare(b.workdate);
      return a.deptcode.localeCompare(b.deptcode);
    });
    topLevelDepartments.forEach(dept => flattenAndAddTotals(dept));
    return finalDisplayList;
  }, [employees, levelCodeToNameMap]);

  const filteredDepartments = useMemo(() => {
    return aggregatedDepartments;
  }, [aggregatedDepartments]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, AggregatedDepartment[]>();
    filteredDepartments.forEach(dept => {
      const date = dept.workdate;
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(dept);
    });

    const finalGroups = Array.from(groups.entries()).map(([date, departments]) => {
      // สร้าง departmentsMap เฉพาะของวันนั้น
      const departmentsMapForDate = new Map<string, AggregatedDepartment>();
      employees.filter(emp => emp.workdate === date).forEach(emp => {
        const fullDeptCode = emp.originalFullDeptcode || emp.deptcode || '';
        const deptcodelevel1 = fullDeptCode.substring(0, 2) + '000000';
        const deptcodelevel2 = fullDeptCode.substring(0, 4) + '0000';
        const deptcodelevel3 = fullDeptCode.substring(0, 6) + '00';
        const deptcodelevel4 = fullDeptCode.substring(0, 8);
        const groupKey = `${emp.workdate}-${fullDeptCode}`;
        if (!departmentsMapForDate.has(groupKey)) {
          departmentsMapForDate.set(groupKey, {
            deptcode: fullDeptCode,
            deptname: levelCodeToNameMap.get(fullDeptCode) || emp.deptname,
            deptsbu: emp.deptsbu,
            deptstd: emp.deptstd,
            totalScanned: Number(emp.countscan),
            totalNotScanned: Number(emp.countnotscan),
            totalPerson: Number(emp.countperson),
            deptcodelevel1,
            deptcodelevel2,
            deptcodelevel3,
            deptcodelevel4,
            workdate: emp.workdate,
            isTotalRow: false,
            // ✅ เปลี่ยนเป็นการบวกตัวเลขหลักสุดท้าย
            sumSbuEndNum: Number(emp.deptsbu.slice(-1)) || 0,
            sumStdEndNum: emp.deptstd ? Number(emp.deptstd.slice(-1)) || 0 : 0,
          });
        } else {
          const dept = departmentsMapForDate.get(groupKey)!;
          dept.totalScanned += Number(emp.countscan);
          dept.totalNotScanned += Number(emp.countnotscan);
          dept.totalPerson += Number(emp.countperson);
          // ✅ เพิ่มการบวกค่าตัวเลขหลักสุดท้าย
          dept.sumSbuEndNum! += Number(emp.deptsbu.slice(-1)) || 0;
          if (emp.deptstd) {
            dept.sumStdEndNum! += Number(emp.deptstd.slice(-1)) || 0;
          }
        }
      });
      // สร้าง parent node ทุกระดับ
      Array.from(departmentsMapForDate.values()).forEach(dept => {
        const level = getDeptLevel(dept);
        if (level === 4) {
          const key = `${dept.workdate}-${dept.deptcodelevel3}`;
          if (!departmentsMapForDate.has(key)) {
            departmentsMapForDate.set(key, {
              deptcode: dept.deptcodelevel3,
              deptname: levelCodeToNameMap.get(dept.deptcodelevel3) || 'รวมแผนก',
              deptsbu: '',
              deptstd: null,
              totalScanned: 0,
              totalNotScanned: 0,
              totalPerson: 0,
              deptcodelevel1: dept.deptcodelevel3.substring(0, 2) + '000000',
              deptcodelevel2: dept.deptcodelevel3.substring(0, 4) + '0000',
              deptcodelevel3: dept.deptcodelevel3,
              deptcodelevel4: dept.deptcodelevel3,
              workdate: dept.workdate,
              isTotalRow: false,
              // ✅ สร้างฟิลด์ผลรวมเริ่มต้นเป็น 0
              sumSbuEndNum: 0,
              sumStdEndNum: 0,
            });
          }
        }
        if (level >= 3) {
          const key = `${dept.workdate}-${dept.deptcodelevel2}`;
          if (!departmentsMapForDate.has(key)) {
            departmentsMapForDate.set(key, {
              deptcode: dept.deptcodelevel2,
              deptname: levelCodeToNameMap.get(dept.deptcodelevel2) || 'รวมฝ่าย',
              deptsbu: '',
              deptstd: null,
              totalScanned: 0,
              totalNotScanned: 0,
              totalPerson: 0,
              deptcodelevel1: dept.deptcodelevel2.substring(0, 2) + '000000',
              deptcodelevel2: dept.deptcodelevel2,
              deptcodelevel3: dept.deptcodelevel2.substring(0, 4) + '0000',
              deptcodelevel4: dept.deptcodelevel2,
              workdate: dept.workdate,
              isTotalRow: false,
              // ✅ สร้างฟิลด์ผลรวมเริ่มต้นเป็น 0
              sumSbuEndNum: 0,
              sumStdEndNum: 0,
            });
          }
        }
        if (level >= 2) {
          const key = `${dept.workdate}-${dept.deptcodelevel1}`;
          if (!departmentsMapForDate.has(key)) {
            departmentsMapForDate.set(key, {
              deptcode: dept.deptcodelevel1,
              deptname: levelCodeToNameMap.get(dept.deptcodelevel1) || 'รวมโรงงาน',
              deptsbu: '',
              deptstd: null,
              totalScanned: 0,
              totalNotScanned: 0,
              totalPerson: 0,
              deptcodelevel1: dept.deptcodelevel1,
              deptcodelevel2: dept.deptcodelevel1.substring(0, 2) + '000000',
              deptcodelevel3: dept.deptcodelevel1.substring(0, 4) + '0000',
              deptcodelevel4: dept.deptcodelevel1,
              workdate: dept.workdate,
              isTotalRow: false,
              
              sumSbuEndNum: 0,
              sumStdEndNum: 0,
            });
          }
        }
      });
      
      const hierarchicalMapForDate = new Map<string, { dept: AggregatedDepartment; children: AggregatedDepartment[] }>();
      departmentsMapForDate.forEach(dept => {
        hierarchicalMapForDate.set(`${dept.workdate}-${dept.deptcode}`, { dept, children: [] });
      });
      Array.from(departmentsMapForDate.values()).forEach(dept => {
        const level = getDeptLevel(dept);
        let parentCode: string | null = null;
        if (level === 4) parentCode = dept.deptcodelevel3;
        else if (level === 3) parentCode = dept.deptcodelevel2;
        else if (level === 2) parentCode = dept.deptcodelevel1;
        const parentEntryKey = parentCode ? `${dept.workdate}-${parentCode}` : null;
        if (parentEntryKey && hierarchicalMapForDate.has(parentEntryKey) && parentEntryKey !== `${dept.workdate}-${dept.deptcode}`) {
          hierarchicalMapForDate.get(parentEntryKey)!.children.push(dept);
        }
      });
      // หา topLevelDepartments ของวันนั้น (level 1)
      const topLevelDepartments = Array.from(departmentsMapForDate.values()).filter(dept => getDeptLevel(dept) === 1);
      // ใช้ recursive รวมค่าจาก topLevelDepartments
      const calculateTotalsIncludingChildren = (deptKey: string): { scanned: number; notScanned: number; person: number; sumSbuEndNum: number; sumStdEndNum: number } => {
        const entry = hierarchicalMapForDate.get(deptKey);
        if (!entry) return { scanned: 0, notScanned: 0, person: 0, sumSbuEndNum: 0, sumStdEndNum: 0 };
        let totalScanned = entry.dept.totalScanned;
        let totalNotScanned = entry.dept.totalNotScanned;
        let totalPerson = entry.dept.totalPerson;
       
        let totalSbuEndNum = entry.dept.sumSbuEndNum || 0;
        let totalStdEndNum = entry.dept.sumStdEndNum || 0;

        entry.children.forEach(child => {
          const childTotals = calculateTotalsIncludingChildren(`${child.workdate}-${child.deptcode}`);
          totalScanned += childTotals.scanned;
          totalNotScanned += childTotals.notScanned;
          totalPerson += childTotals.person;
          
          totalSbuEndNum += childTotals.sumSbuEndNum;
          totalStdEndNum += childTotals.sumStdEndNum;
        });
        return { scanned: totalScanned, notScanned: totalNotScanned, person: totalPerson, sumSbuEndNum: totalSbuEndNum, sumStdEndNum: totalStdEndNum };
      };
      let grandTotalSbuEndNum = 0;
      let grandTotalStdEndNum = 0;
      let totalScanned = 0;
      let totalNotScanned = 0;
      let totalPerson = 0;
      topLevelDepartments.forEach(dept => {
        const deptKey = `${dept.workdate}-${dept.deptcode}`;
        const totals = calculateTotalsIncludingChildren(deptKey);
        totalScanned += totals.scanned;
        totalNotScanned += totals.notScanned;
        totalPerson += totals.person;
        grandTotalSbuEndNum += totals.sumSbuEndNum;
        grandTotalStdEndNum += totals.sumStdEndNum;
      });
      const grandTotalRow: AggregatedDepartment = {
        deptcode: `GRAND_TOTAL_${date}`,
        deptname: 'All Haier',
        deptsbu: '',
        deptstd: null,
        totalScanned,
        totalNotScanned,
        totalPerson,
        deptcodelevel1: '',
        deptcodelevel2: '',
        deptcodelevel3: '',
        deptcodelevel4: '',
        workdate: date,
        isTotalRow: true,
        
        sumSbuEndNum: grandTotalSbuEndNum,
        sumStdEndNum: grandTotalStdEndNum,
      };
      if (grandTotalRow.totalPerson > 0 || grandTotalRow.totalScanned > 0 || grandTotalRow.totalNotScanned > 0) {
        return [date, [...departments, grandTotalRow]] as [string, AggregatedDepartment[]];
      }
      return [date, departments] as [string, AggregatedDepartment[]];
    });

    return finalGroups.sort(([dateA], [dateB]) => dateA.localeCompare(dateB));
  }, [filteredDepartments, employees, levelCodeToNameMap]);


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

  //สีของแต่ละ Level
  const levelColors = [
    'bg-blue-200', // Level 1: โรงงาน
    'bg-blue-100', // Level 2: ฝ่าย
    'bg-blue-50',   // Level 3: แผนก
    'bg-white'      // Level 4: หน่วยงานย่อย
  ];

  return (
    <div>
      {groupedByDate.map(([date, departmentsForDate]) => (
        <div
          key={date}
          className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-4"
        >
          <div className="bg-blue-600 text-white p-3 font-bold text-xl">
            {`Date : ${date}`}
          </div>

          <div className="overflow-x-auto p-4">
            <table className="min-w-full text-sm text-center border-collapse ">
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
                  const linkWorkdate = dept.workdate;
                  let effectiveDeptCode = dept.deptcode;
                  if (dept.isTotalRow) {
                    effectiveDeptCode = dept.deptcode.replace('TOTAL_', '');
                  }
                  const deptLevel = getDeptLevel({ ...dept, deptcode: effectiveDeptCode });

                  const displayedDeptCode = dept.isTotalRow ? '' : dept.deptcode;
                  
                  const displaySBU = dept.isTotalRow ? (dept.sumSbuEndNum !== undefined ? dept.sumSbuEndNum.toLocaleString() : '') : dept.deptsbu;
                  const displaySTD = dept.isTotalRow ? (dept.sumStdEndNum !== undefined ? dept.sumStdEndNum.toLocaleString() : '') : dept.deptstd;
                  const displayedTotalScanned = dept.totalScanned.toLocaleString();
                  const displayedTotalNotScanned = dept.totalNotScanned.toLocaleString();
                  const displayedTotalPerson = dept.totalPerson.toLocaleString();

                  const handleLinkClick = () => {
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('prevDashboardDate', linkWorkdate);
                    }
                  };

                  let href = '';
                  if (dept.deptname === 'Grand Total' || dept.deptname === 'รวมทั้งโรงงานทั้งหมด') {
                    const allLeafCodesForDate = employees
                      .filter(emp => emp.workdate === linkWorkdate)
                      .map(emp => emp.originalFullDeptcode || emp.deptcode)
                      .filter(code => getDeptLevel({ deptcode: code, deptname: '', deptsbu: '', deptstd: '', totalScanned: 0, totalNotScanned: 0, totalPerson: 0, deptcodelevel1: '', deptcodelevel2: '', deptcodelevel3: '', deptcodelevel4: '', workdate: '' }) === 4);
                    const uniqueLeafCodes = [...new Set(allLeafCodesForDate)].sort();
                    const deptcodes = uniqueLeafCodes.join(',');
                    href = `/report/details?deptcodes=${encodeURIComponent(deptcodes)}&workdate=${encodeURIComponent(linkWorkdate)}`;
                  } else if (dept.isTotalRow) {
                    let filterPrefix = '';
                    if (deptLevel === 1) {
                      filterPrefix = effectiveDeptCode.substring(0, 2);
                    } else if (deptLevel === 2) {
                      filterPrefix = effectiveDeptCode.substring(0, 4);
                    } else if (deptLevel === 3) {
                      filterPrefix = effectiveDeptCode.substring(0, 6);
                    }

                    const descendantCodes = employees.filter(emp =>
                      (emp.originalFullDeptcode || emp.deptcode).startsWith(filterPrefix) && (emp.originalFullDeptcode || emp.deptcode).length === 8
                    ).map(emp => emp.originalFullDeptcode || emp.deptcode);

                    const uniqueDescendantCodes = [...new Set(descendantCodes)].sort();
                    const deptcodes = uniqueDescendantCodes.join(',');

                    href = `/report/details?deptcodes=${encodeURIComponent(deptcodes)}&workdate=${encodeURIComponent(linkWorkdate)}`;
                  } else {
                    href = `/report/details?deptcodes=${encodeURIComponent(dept.deptcode)}&workdate=${encodeURIComponent(linkWorkdate)}`;
                  }

                  const paddingLeft = dept.isTotalRow ? (dept.deptname === 'Grand Total' ? 0 : 0) : (deptLevel - 1) * 25;
                  let rowBgClass = '';
                  if (dept.deptname === 'Grand Total' || dept.deptname === 'รวมทั้งโรงงานทั้งหมด') {
                    rowBgClass = 'bg-red-200 font-bold';
                  } else if (dept.isTotalRow) {
                    if (deptLevel === 1) {
                      rowBgClass = 'bg-yellow-300 font-bold';
                    } else if (deptLevel === 2) {
                      rowBgClass = 'bg-blue-300 font-bold';
                    } else if (deptLevel === 3) {
                      rowBgClass = 'bg-green-200 font-bold';
                    } else {
                      rowBgClass = 'bg-gray-300 font-bold';
                    }
                  } else {
                    rowBgClass = levelColors[deptLevel - 1] || 'bg-white';
                  }
                  const verticalPaddingClass = (dept.deptname === 'Grand Total' || deptLevel === 1 || deptLevel === 2 || dept.isTotalRow) ? 'py-3' : 'py-2';

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
                        <Link
                          href={href}
                          onClick={handleLinkClick}
                          passHref
                        >
                          <PiFileMagnifyingGlassBold size={30} className="text-blue-500 hover:text-blue-700" />
                        </Link>
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
          className="fixed bottom-8 right-8 z-50 bg-[#16aaff] rounded-full shadow-lg p-0 w-16 h-16 flex items-center justify-center hover:bg-blue-700 transition"
          aria-label="Back to top"
          type="button"
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