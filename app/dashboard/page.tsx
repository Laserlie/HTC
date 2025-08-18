'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import AttendanceCardSummary from '@/components/AttendanceCardSummary';
import Spinner from '@/components/ui/Spinner';

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
    return new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
  });

  const [totalScanned, setTotalScanned] = useState(0);
  const [totalNotScanned, setTotalNotScanned] = useState(0);
  const [selectedFactory, setSelectedFactory] = useState('all'); 

  type SummaryData = {
    totalScanned: number;
    totalNotScanned: number;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        let apiUrl = `/api/attendance/summary?date=${selectedDate}`;
        if (selectedFactory !== 'all') {
          apiUrl += `&deptCode=${selectedFactory}`;
        }

        const res = await fetch(apiUrl);
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
  }, [selectedDate, selectedFactory]); 

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dashboardSelectedDate', selectedDate);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('reportSelectedDate', selectedDate);
    }
  }, [selectedDate]);

  // สร้าง URL สำหรับ DepartmentBarChart
  let barChartApiEndpoint = `/api/department/Barchart?date=${selectedDate}`;
  if (selectedFactory !== 'all') {
    barChartApiEndpoint += `&deptCode=${selectedFactory}`;
  }


  return (
    <div className="p-4 sm:p-6 space-y-6"> 
     <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-2xl sm:text-3xl font-semibold">ภาพรวมวันที่ {selectedDate}</h1>
          <div className="flex gap-2 items-center">
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring focus:border-blue-300 text-base"
            />
            <select
              id="factorySelect"
              value={selectedFactory}
              onChange={(e) => setSelectedFactory(e.target.value)}
              className="border px-3 py-2 rounded-md shadow-sm focus:outline-none focus:ring focus:border-blue-300 w-[160px] sm:w-auto text-base"
            >
              <option value="all">ทั้งหมด</option>
              <option value="06">Platform</option>
              <option value="07">AC EMC Micro</option>
              <option value="08">RF EMC Micro</option>
              <option value="09">FUL FILL</option>
            </select>
          </div>
        </div>
        <AttendanceCardSummary
          totalScanned={totalScanned}
          totalNotScanned={totalNotScanned}
          from={selectedDate}
          to={selectedDate}
          deptCode={selectedFactory}
        />
      </section>

      <section className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-semibold">Department Overview</h1> 
        <DepartmentBarChart apiEndpoint={barChartApiEndpoint} deptCode={selectedFactory} />
      </section>

      <section className="space-y-4">
       
        <div className="mb-4 flex flex-row justify-between items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-semibold">Manpower Monitoring</h1>
        </div>
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
