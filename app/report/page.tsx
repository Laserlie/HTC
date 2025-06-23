'use client';

import { useState, useEffect, useCallback } from 'react';
import ReportFilterForm from '../../components/ReportFilterForm';
import { DepartmentTable } from '../../components/DepartmentTable';
import { Employee, ReportApiRawData } from '../types/employee';
import Spinner from '../../components/ui/Spinner';

const parseDeptCode = (fullDeptCode: string) => {
  const level1 = fullDeptCode.length >= 2 ? fullDeptCode.substring(0, 2) : '';
  const level2 = fullDeptCode.length >= 4 ? fullDeptCode.substring(0, 4) : '';
  const level3 = fullDeptCode.length >= 6 ? fullDeptCode.substring(0, 6) : '';
  return { level1, level2, level3 };
};

export default function ReportPage() {
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    factoryId: '',
    mainDepartmentId: '',
    subDepartmentId: '',
    employeeId: 'all',
  });
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  const fetchAndProcessData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      const res = await fetch(`/api/manpower?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const rawData: ReportApiRawData[] = await res.json();

      const levelCodeToNameMap = new Map<string, string>();
      rawData.forEach(item => {
        if (item.deptcode) {
          const { level1, level2, level3 } = parseDeptCode(item.deptcode);
          if (level1 && item.deptname && (!levelCodeToNameMap.has(level1) || item.deptname.length > (levelCodeToNameMap.get(level1)?.length || 0))) {
              levelCodeToNameMap.set(level1, item.deptname);
          }
          if (level2 && item.deptname && (!levelCodeToNameMap.has(level2) || item.deptname.length > (levelCodeToNameMap.get(level2)?.length || 0))) {
              levelCodeToNameMap.set(level2, item.deptname);
          }
          if (level3 && item.deptname && (!levelCodeToNameMap.has(level3) || item.deptname.length > (levelCodeToNameMap.get(level3)?.length || 0))) {
              levelCodeToNameMap.set(level3, item.deptname);
          }
        }
      });

      const filteredRawData = rawData.filter(item => {
        if (!item.deptcode) return false;

        const { level1, level2, level3 } = parseDeptCode(item.deptcode);

        if (filters.factoryId && level1 !== filters.factoryId) {
          return false;
        }
        if (filters.mainDepartmentId && level2 !== filters.mainDepartmentId) {
          return false;
        }
        if (filters.subDepartmentId && level3 !== filters.subDepartmentId) {
          return false;
        }

        const countScanVal = parseInt(item.countscan || '0');
        const countNotScanVal = parseInt(item.countnotscan || '0');

        if (filters.employeeId === 'scanned' && countScanVal === 0) {
          return false;
        }
        if (filters.employeeId === 'not_scanned' && countNotScanVal === 0) {
          return false;
        }
        return true;
      });

      const groupedData = new Map<string, Employee>();

      filteredRawData.forEach(item => {
        const groupKey = `${item.workdate}-${item.deptcode}`;
        const currentCountScan = parseInt(item.countscan || '0');
        const currentCountNotScan = parseInt(item.countnotscan || '0');
        const currentCountPerson = parseInt(item.countperson || '0');
        const currentLate = parseInt(item.late || '0');

        if (groupedData.has(groupKey)) {
          const existingEmployee = groupedData.get(groupKey)!;
          existingEmployee.countscan += currentCountScan;
          existingEmployee.countnotscan += currentCountNotScan;
          existingEmployee.countperson += currentCountPerson;
          existingEmployee.late += currentLate;
        } else {
          const { level1, level2, level3 } = item.deptcode ? parseDeptCode(item.deptcode) : { level1: '', level2: '', level3: '' };

          groupedData.set(groupKey, {
            employeeId: item.employeeId || '',
            groupid: item.groupid || '',
            groupname: item.groupname || '',
            workdate: item.workdate || '',
            deptcode: level3,
            deptname: item.deptname || '',
            deptsbu: item.deptsbu || '',
            deptstd: item.deptstd !== undefined ? item.deptstd : null,
            countscan: currentCountScan,
            countnotscan: currentCountNotScan,
            countperson: currentCountPerson,
            late: currentLate,
            factoryCode: level1,
            factoryName: levelCodeToNameMap.get(level1) || `โรงงาน ${level1}`,
            mainDepartmentCode: level2,
            mainDepartmentName: levelCodeToNameMap.get(level2) || `แผนกหลัก ${level2}`,
            subDepartmentCode: level3,
            subDepartmentName: levelCodeToNameMap.get(level3) || item.deptname || `แผนกย่อย/ส่วนงาน ${level3}`,
            originalFullDeptcode: item.deptcode, 
          });
        }
      });

      const processedData: Employee[] = Array.from(groupedData.values());
      processedData.sort((a, b) => {
        if (a.workdate !== b.workdate) return a.workdate.localeCompare(b.workdate);
        return a.originalFullDeptcode.localeCompare(b.originalFullDeptcode);
      });

      setFilteredEmployees(processedData);
    } catch (err) {
      console.error('Error fetching or processing data:', err);
      setFilteredEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (hasSearched) {
      fetchAndProcessData();
    }
  }, [fetchAndProcessData, hasSearched]);

  const handleSearch = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setHasSearched(true); 
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Scan Data List</h1>

      <ReportFilterForm onSearch={handleSearch} initialFilters={filters} />

      {!hasSearched ? (
        <div className="text-center text-gray-500 py-8">กรุณาเลือกช่วงวันที่และกด Search เพื่อแสดงข้อมูล</div>
      ) : loading ? (
        <Spinner />
      ) : (
        <DepartmentTable employees={filteredEmployees} scanStatus={filters.employeeId} />
      )}
    </div>
  );
}