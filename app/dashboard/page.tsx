'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import AttendanceCardSummary from '@/components/AttendanceCardSummary';
// Assuming Spinner exists in '@/components/ui/Spinner'
import Spinner from '@/components/ui/Spinner';

// Dynamic imports for client-side components
const DepartmentBarChart = dynamic(
  () => import('@/components/DepartmentBarChart'),
  { ssr: false }
);

const ManpowerTable = dynamic(
  () => import('@/components/ManpowerTable').then(mod => mod.ManpowerTable),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center p-4 min-h-[200px]">
        <Spinner />
      </div>
    ),
  }
);

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(() => {
    // Always default to today's date in YYYY-MM-DD format
    return new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  });

  const [totalScanned, setTotalScanned] = useState(0);
  const [totalNotScanned, setTotalNotScanned] = useState(0);
  const [selectedFactory, setSelectedFactory] = useState('all'); // Used as deptCode for Dashboard overview

  type SummaryData = {
    totalScanned: number;
    totalNotScanned: number;
  };

  // Effect to fetch attendance summary when selectedDate changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/attendance/summary?date=${selectedDate}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to fetch data');
        }
        const data: SummaryData = await res.json();
        setTotalScanned(data.totalScanned);
        setTotalNotScanned(data.totalNotScanned);
      } catch (err) {
        console.error('Error fetching attendance summary:', err);
        setTotalScanned(0);
        setTotalNotScanned(0);
      }
    };
    fetchData();
  }, [selectedDate]);

  // Effect to save selectedDate to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dashboardSelectedDate', selectedDate);
    }
  }, [selectedDate]);

  // This might be redundant if 'dashboardSelectedDate' is sufficient for reports
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('reportSelectedDate', selectedDate);
    }
  }, [selectedDate]);

  return (
    <div className="p-4 sm:p-6 space-y-6"> {/* Adjusted base padding for smaller screens */}
      <section className="flex justify-end mb-4">
        {/* Adjusted for responsiveness: flex-col on small screens, flex-row on sm and up */}
        <label className="flex flex-col sm:flex-row items-end sm:items-center bg-white rounded-lg shadow-md py-2 px-4 transition-all duration-300 hover:shadow-lg">
          <span className="text-gray-700 font-semibold mr-3 text-base sm:text-lg mb-2 sm:mb-0">เลือกวันที่ :</span> {/* Adjust font size for mobile */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="block w-full sm:w-auto border border-gray-300 bg-gray-50 text-gray-900 text-base sm:text-lg rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 outline-none cursor-pointer"
          /> {/* Ensure input takes full width on small screens, auto on larger */}
        </label>
      </section>

      <section className="space-y-6">
        <h1 className="text-xl sm:text-2xl font-semibold">ภาพรวมวันที่ {selectedDate}</h1> {/* Adjust font size for mobile */}
        <AttendanceCardSummary
          totalScanned={totalScanned}
          totalNotScanned={totalNotScanned}
          from={selectedDate}
          to={selectedDate}
          deptCode={selectedFactory}
        />
      </section>

      <section className="space-y-4">
        <h1 className="text-lg sm:text-xl font-semibold">Department Overview</h1> {/* Adjust font size for mobile */}
        <DepartmentBarChart apiEndpoint={`/api/department/Barchart?date=${selectedDate}`} />
      </section>

      <section className="space-y-4">
       
        <div className="mb-4 flex flex-row justify-between items-center gap-2">
          <h1 className="text-lg sm:text-xl font-semibold">Manpower Monitoring</h1>
          <div>
            <select
              id="factorySelect"
              value={selectedFactory}
              onChange={(e) => setSelectedFactory(e.target.value)}
              className="border px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring focus:border-blue-300 w-[160px] sm:w-auto"
            >
              <option value="all">ทั้งหมด</option>
              <option value="06">โรงงาน 1 (&quot;06&quot;)</option>
              <option value="07">โรงงาน 2 (&quot;07&quot;)</option>
              <option value="08">โรงงาน 3 (&quot;08&quot;)</option>
            </select>
          </div>
        </div>
        {/* Added overflow-x-auto for responsive table scrolling */}
        <div className="overflow-x-auto">
          <ManpowerTable
            selectedDate={selectedDate}
            scanStatus=""
            deptcodelevel1Filter={selectedFactory === 'all' ? undefined : selectedFactory}
          />
        </div>
      </section>
    </div>
  );
}