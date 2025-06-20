'use client';

import Link from 'next/link';
import { PiFileMagnifyingGlassBold } from "react-icons/pi";
import { Employee } from '../app/types/employee'; 
import { useRef, useEffect, useState } from 'react';

export type DepartmentTableProps = {
  employees: Employee[]; 
  scanStatus?: string; 
  onLoadMore?: () => void; 
  hasMore?: boolean; 
};

export function DepartmentTable({ employees, scanStatus = 'all', onLoadMore, hasMore }: DepartmentTableProps) {
  const loadMoreRef = useRef<HTMLTableRowElement | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    if (!onLoadMore || !hasMore) return;
    let fetching = false;
    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !fetching) {
          fetching = true;
          setIsLoadingMore(true);
          Promise.resolve(onLoadMore()).finally(() => {
            setIsLoadingMore(false);
            fetching = false;
          });
        }
      },
      { threshold: 1 }
    );
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [onLoadMore, hasMore, employees.length]);

  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow p-4">
      <table className="min-w-full text-sm text-left border-collapse">
        <thead className="border-b text-gray-600">
          <tr>
            <th className="py-2 px-6">Workdate</th>
            <th className="py-2 px-6">Deptcode </th> 
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
          {employees.length > 0 ? (
            <>
              {employees.map((emp, index) => {
                
                const safeDeptCode = emp.originalFullDeptcode || `invalid-dept-${index}`; 
                const safeWorkDate = emp.workdate || 'invalid-date';

                return (
                  <tr
                    key={`${safeDeptCode}-${safeWorkDate}-${index}`}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <td className="py-2 px-6">{emp.workdate}</td>
                    <td className="py-2 px-6">{emp.originalFullDeptcode}</td> 
                    <td className="py-2 px-5">{emp.deptname}</td>
                    <td className="py-2 px-6">{emp.deptsbu}</td>
                    <td className="py-2 px-6">{emp.deptstd}</td>

                    {scanStatus !== 'not_scanned' && (
                      <td className="py-2 px-6">{emp.countscan}</td>
                    )}
                    {scanStatus !== 'scanned' && (
                      <td className="py-2 px-6">{emp.countnotscan}</td>
                    )}
                    <td className="py-2 px-6">{emp.countperson}</td>
                    <td className="p-3">
                      {emp.originalFullDeptcode && emp.workdate ? ( 
                        <Link
                          href={`/report/${encodeURIComponent(safeDeptCode)}?workdate=${encodeURIComponent(safeWorkDate)}`}
                          passHref
                        >
                          <PiFileMagnifyingGlassBold
                            size={30}
                            className="text-blue-500 hover:text-blue-700"
                            title="ดูรายละเอียด"
                          />
                        </Link>
                      ) : (
                        <span className="text-gray-400 italic">ไม่สามารถเปิดดูได้</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {hasMore && (
                <tr ref={loadMoreRef}>
                  <td colSpan={scanStatus === 'all' ? 9 : 8} className="py-4 px-6 text-center text-gray-400">
                    {isLoadingMore ? "กำลังโหลดข้อมูลเพิ่ม..." : "เลื่อนเพื่อโหลดข้อมูลเพิ่ม"}
                  </td>
                </tr>
              )}
            </>
          ) : (
            <tr>
              <td colSpan={scanStatus === 'all' ? 9 : 8} className="py-4 px-6 text-center text-gray-500">
                ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}