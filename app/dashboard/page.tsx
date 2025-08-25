'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import AttendanceCardSummary from '@/components/AttendanceCardSummary';
import Spinner from '@/components/ui/Spinner';

// Dynamic imports with server-side rendering disabled
const DepartmentBarChart = dynamic(
  () => import('@/components/DepartmentBarChart'),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center p-4 min-h-[200px]">
        <Spinner />
      </div>
    ),
  }
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
  // ตั้งค่าเริ่มต้นที่คงที่บนเซิร์ฟเวอร์เพื่อป้องกัน hydration mismatch
  const [selectedDate, setSelectedDate] = useState('');
  const [totalScanned, setTotalScanned] = useState(0);
  const [totalNotScanned, setTotalNotScanned] = useState(0);
  const [selectedFactory, setSelectedFactory] = useState('all');
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // useEffect สำหรับจัดการค่าเริ่มต้นและนาฬิกา Real-time
  useEffect(() => {
    // ตั้งค่า selectedDate และ currentTime เมื่อ Component ถูก mount บน Client
    const storedDate = sessionStorage.getItem('dashboardSelectedDate');
    const initialDate = storedDate || new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
    setSelectedDate(initialDate);
    setCurrentTime(new Date());

    // ตั้งค่า Interval สำหรับนาฬิกา
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  type SummaryData = {
    totalScanned: number;
    totalNotScanned: number;
  };

  // useEffect หลัก: ดึงข้อมูลและอัปเดต sessionStorage เมื่อวันที่หรือโรงงานเปลี่ยน
  useEffect(() => {
    // ตรวจสอบให้แน่ใจว่า selectedDate มีค่าแล้วก่อนเรียก fetchData
    if (selectedDate) {
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

      // อัปเดต sessionStorage ที่นี่
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('dashboardSelectedDate', selectedDate);
        sessionStorage.setItem('reportSelectedDate', selectedDate);
      }
    }
  }, [selectedDate, selectedFactory]);

  // สร้าง URL สำหรับ DepartmentBarChart
  let barChartApiEndpoint = `/api/department/Barchart?date=${selectedDate}`;
  if (selectedFactory !== 'all') {
    barChartApiEndpoint += `&deptCode=${selectedFactory}`;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2">
          <h1 className="text-3xl sm:text-5xl font-extrabold text-center">DATE {selectedDate}</h1>
          <div className="flex-1 text-center sm:text-right mt-2 sm:mt-0 flex justify-center">
            <span className="text-lg sm:text-2xl font-semibold text-gray-500">
              {/* แสดง "Loading..." ในขณะที่กำลังรอเวลาจากฝั่ง Client */}
              {currentTime ? currentTime.toLocaleTimeString() : 'Loading...'}
            </span>
          </div>
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
              className="border px-3 py-3 rounded-md shadow-sm focus:outline-none focus:ring focus:border-blue-300 w-[160px] sm:w-auto text-base"
            >
              <option value="all">All</option>
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

      <section className="space-y-4 bg-gray-50 p-4 rounded-lg shadow-lg">
        <h1 className="text-xl sm:text-6xl font-bold ">Department Overview</h1>
        <DepartmentBarChart apiEndpoint={barChartApiEndpoint} deptCode={selectedFactory} />
      </section>

      <section className="space-y-4 bg-gray-50 p-4 rounded-lg shadow-lg">
        <div className="mb-4 flex flex-row justify-between items-center gap-2">
          <h1 className="text-xl sm:text-6xl font-bold">Manpower Monitoring</h1>
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
