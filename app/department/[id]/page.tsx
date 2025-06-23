'use client';

import { useEffect, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import { DepartmentTable } from '@/components/DepartmentTable';
import Spinner from '@/components/ui/Spinner';
import type { Employee, ReportApiRawData } from '@/app/types/employee';

export default function DepartmentDetailPage() {
  const params = useParams();
  const id = params?.id;

  const [department, setDepartment] = useState<{ name: string; employees: Employee[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchDepartment() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || '';
        const base = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase;
        const res = await fetch(`${base}/api/department/${id}`);

        if (!res.ok) {
          notFound();
        }

        const data = await res.json();

        const employees: Employee[] = (data.employees as ReportApiRawData[]).map((emp) => ({
          employeeId: emp.employeeId ?? '',
          groupid: emp.groupid ?? '',
          groupname: emp.groupname ?? '',
          workdate: emp.workdate ?? '',
          deptcode: emp.deptcode ?? '',
          deptname: emp.deptname ?? '',
          deptsbu: emp.deptsbu ?? '',
          deptstd: emp.deptstd ?? null,
          countscan: Number(emp.countscan ?? 0),
          countnotscan: Number(emp.countnotscan ?? 0),
          countperson: Number(emp.countperson ?? 0),
          late: emp.late !== undefined ? Number(emp.late) : 0,
          factoryCode: '', 
          factoryName: '',
          mainDepartmentCode: '',
          mainDepartmentName: '',
          subDepartmentCode: '',
          subDepartmentName: '',
          originalFullDeptcode: emp.deptcode ?? '',
        }));

        setDepartment({ name: data.name, employees });
      } catch (error) {
        console.error('Failed to fetch department: ', error);
        notFound();
      } finally {
        setLoading(false);
      }
    }

    fetchDepartment();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (!department) {
    return null;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">แผนก : {department.name}</h1>
      <DepartmentTable employees={department.employees} scanStatus="all" />
    </div>
  );
}
