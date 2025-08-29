// pages/report/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReportFilterForm from '../../components/ReportFilterForm';
import { DepartmentTable } from '../../components/DepartmentTable';
import { Employee, ReportApiRawData } from '../types/employee';
import Spinner from '../../components/ui/Spinner';


const parseDeptCode = (fullDeptCode: string) => {
  const level1 = fullDeptCode.length >= 2 ? fullDeptCode.substring(0, 2) : '';
  const level2 = fullDeptCode.length >= 4 ? fullDeptCode.substring(0, 4) : '';
  const level3 = fullDeptCode.length >= 6 ? fullDeptCode.substring(0, 6) : '';
  const level4 = fullDeptCode.length >= 8 ? fullDeptCode.substring(0, 8) : '';
  return { level1, level2, level3, level4 };
};


const getInitialFilters = (searchParams: ReturnType<typeof useSearchParams>) => ({
  from: searchParams.get('from') || '',
  to: searchParams.get('to') || '',
  factoryId: searchParams.get('factoryId') || '',
  mainDepartmentId: searchParams.get('mainDepartmentId') || '',
  subDepartmentId: searchParams.get('subDepartmentId') || '',
  divisionId: searchParams.get('divisionId') || '', 
  employeeId: searchParams.get('employeeId') || 'all',
});

function ReportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState(getInitialFilters(searchParams));
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [levelCodeToNameMap, setLevelCodeToNameMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    setFilters(getInitialFilters(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const hasSearched = !!(filters.from && filters.to);

    if (hasSearched) {
      setLoading(true);
      const fetchAndProcessData = async () => {
        try {
          const params = new URLSearchParams();
          if (filters.from) params.append('from', filters.from);
          if (filters.to) params.append('to', filters.to);
          const res = await fetch(`/api/manpower?${params.toString()}`);
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          const rawData: ReportApiRawData[] = await res.json();

          const newLevelCodeToNameMap = new Map<string, string>();
          rawData.forEach(item => {
            if (item.deptcode && item.deptname) {
              newLevelCodeToNameMap.set(item.deptcode, item.deptname);
              
              const { level1, level2, level3, level4 } = parseDeptCode(item.deptcode);
              if (level1) newLevelCodeToNameMap.set(level1, item.deptname);
              if (level2) newLevelCodeToNameMap.set(level2, item.deptname);
              if (level3) newLevelCodeToNameMap.set(level3, item.deptname);
              if (level4) newLevelCodeToNameMap.set(level4, item.deptname);
            }
          });
          setLevelCodeToNameMap(newLevelCodeToNameMap);

          const filteredRawData = rawData.filter(item => {
            if (!item.deptcode) return false;
           
            const { level1, level2, level3, level4 } = parseDeptCode(item.deptcode);
            
           
            if (filters.factoryId && level1 !== filters.factoryId) return false;
            if (filters.mainDepartmentId && level2 !== filters.mainDepartmentId) return false;
            if (filters.subDepartmentId && level3 !== filters.subDepartmentId) return false;
            if (filters.divisionId && level4 !== filters.divisionId) return false;

            const countScanVal = parseInt(item.countscan || '0');
            const countNotScanVal = parseInt(item.countnotscan || '0');
            if (filters.employeeId === 'scanned' && countScanVal === 0) return false;
            if (filters.employeeId === 'not_scanned' && countNotScanVal === 0) return false;
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
             
              const { level1, level2, level3, level4 } = item.deptcode ? parseDeptCode(item.deptcode) : { level1: '', level2: '', level3: '', level4: '' };
              groupedData.set(groupKey, {
                employeeId: item.employeeId || '',
                groupid: item.groupid || '',
                groupname: item.groupname || '',
                workdate: item.workdate || '',
                deptcode: item.deptcode,
                deptname: newLevelCodeToNameMap.get(item.deptcode) || item.deptname || '',
                deptsbu: item.deptsbu || '',
                deptstd: item.deptstd !== undefined ? item.deptstd : null,
                countscan: currentCountScan,
                countnotscan: currentCountNotScan,
                countperson: currentCountPerson,
                late: currentLate,
                factoryCode: level1,
                factoryName: newLevelCodeToNameMap.get(level1) || `โรงงาน ${level1}`,
                mainDepartmentCode: level2,
                mainDepartmentName: newLevelCodeToNameMap.get(level2) || `แผนกหลัก ${level2}`,
                subDepartmentCode: level3,
                subDepartmentName: newLevelCodeToNameMap.get(level3) || `แผนกย่อย/ส่วนงาน ${level3}`,
                divisionCode: level4,
                divisionName: newLevelCodeToNameMap.get(level4) || `แผนกย่อย ${level4}`,
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
      };
      fetchAndProcessData();
    } else {
      setLoading(false);
      setFilteredEmployees([]);
    }
  }, [filters]); // Dependency array: filters

  const handleSearch = (newFilters: typeof filters) => {
    const params = new URLSearchParams();
    if (newFilters.from) params.set('from', newFilters.from);
    if (newFilters.to) params.set('to', newFilters.to);
    if (newFilters.factoryId) params.set('factoryId', newFilters.factoryId);
    if (newFilters.mainDepartmentId) params.set('mainDepartmentId', newFilters.mainDepartmentId);
    if (newFilters.subDepartmentId) params.set('subDepartmentId', newFilters.subDepartmentId);
    if (newFilters.divisionId) params.set('divisionId', newFilters.divisionId);
    if (newFilters.employeeId && newFilters.employeeId !== 'all') params.set('employeeId', newFilters.employeeId);
    router.replace(`/report?${params.toString()}`);
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Scan Data List</h1>
      <ReportFilterForm onSearch={handleSearch} initialFilters={filters} />
      {!filters.from || !filters.to ? (
        <div className="text-center text-gray-500 py-8">Please select a date range and press Search to display the information.</div>
      ) : loading ? (
        <Spinner />
      ) : (
        <DepartmentTable
          employees={filteredEmployees}
          scanStatus={filters.employeeId}
          levelCodeToNameMap={levelCodeToNameMap}
        />
      )}
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ReportPageContent />
    </Suspense>
  );
}