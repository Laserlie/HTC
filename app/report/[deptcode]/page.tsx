"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PiFileMagnifyingGlassBold } from 'react-icons/pi';

import { FaCheckCircle, FaExclamationCircle, FaUsers } from 'react-icons/fa';
import Spinner from '@/components/ui/Spinner';

// ขยาย Type ของ Detail ให้มี workdate
// (Extend the Detail type to include workdate)
type Detail = {
  workdate: string; // เพิ่มฟิลด์นี้เข้ามา
  person_code: string;
  htcpersoncode: string;
  deptcode: string;
  full_name: string;
  department_full_paths: string;
  deptname: string;
  PersonType: string;
  firstscantime: string | null;
  lastscantime: string | null;
  shiftname: string;
};

// ฟังก์ชันสำหรับสร้างรายการวันที่ทั้งหมดในช่วงที่กำหนด
// (Function to generate a list of dates within a range)
const getDatesBetween = (start: string, end: string): string[] => {
  const dates = [];
  const currentDate = new Date(start);
  const lastDate = new Date(end);

  while (currentDate <= lastDate) {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
};

export default function ReportDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deptcodesParam = searchParams.get('deptcodes');
  const workdateParam = searchParams.get('workdate'); // ดึง workdate จาก URL
  const initialStartDate = searchParams.get('startDate') || workdateParam || ''; // ใช้ workdate เป็นค่าเริ่มต้นถ้ามี
  const initialEndDate = searchParams.get('endDate') || initialStartDate; // ใช้ startDate เป็นค่าเริ่มต้นถ้าไม่มี endDate

  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [details, setDetails] = useState<Detail[]>([]);
  const [loading, setLoading] = useState(false);
  const [deptInfo, setDeptInfo] = useState<Record<string, string>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ย้าย isValidDate เข้าไปใน useCallback

  // แก้ไข: ใช้ useCallback กับ fetchDetails และแก้ type error ใน catch
  const fetchDetails = useCallback(async () => {
    setFetchError(null);
    const isValidDate = (dateStr: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr).getTime());
    const invalidDept = !deptcodesParam || deptcodesParam === '';
    const invalidDates = !startDate || !isValidDate(startDate) || !endDate || !isValidDate(endDate);

    if (invalidDept || invalidDates) {
      const errorMessage = invalidDept
        ? 'Invalid department code'
        : 'Invalid date format';
      setFetchError(errorMessage);
      return;
    }

    setLoading(true);

    const dateList = getDatesBetween(startDate, endDate);

    try {
      const allDetails: Detail[] = [];
      const deptNamesMap: Record<string, string> = {};

      // ส่งคำขอ API สำหรับแต่ละวันในรายการ
      const fetchPromises = dateList.map(async (date) => {
        const searchParamsForApi = new URLSearchParams();
        searchParamsForApi.append('deptcodes', deptcodesParam);
        searchParamsForApi.append('workdate', date);
        try {
          const res = await fetch(`/api/attendance/report/detail?${searchParamsForApi.toString()}`);
          if (!res.ok) {
            const errorData = await res.json();
            console.error(`Failed to fetch data for ${date}:`, errorData);
            return null;
          }
          const data = await res.json();
          return data;
        } catch (err: unknown) {
          console.error(`Error fetching data for ${date}:`, err);
          return null;
        }
      });

      const results = await Promise.all(fetchPromises);
      results.forEach(result => {
        if (result && result.dataByDate) {
          Object.keys(result.dataByDate).forEach(date => {
            result.dataByDate[date].forEach((detail: Omit<Detail, 'workdate'>) => {
              allDetails.push({ ...detail, workdate: date });
              if (!deptNamesMap[detail.deptcode]) {
                deptNamesMap[detail.deptcode] = detail.deptname;
              }
            });
          });
        }
      });
      const sortedDetails = (allDetails || []).sort((a: Detail, b: Detail) => {
        return (a.person_code ?? '').localeCompare((b.person_code ?? ''), undefined, { numeric: true });
      });
      setDetails(sortedDetails);
      setDeptInfo(deptNamesMap);
    } catch (err: unknown) {
      console.error('error:', err);
      setDetails([]);
      setDeptInfo({});
      setFetchError('An error occurred while retrieving all data.');
    } finally {
      setLoading(false);
    }
  }, [deptcodesParam, startDate, endDate]);

  // ใช้ useEffect เพื่อเรียก fetchDetails เมื่อ startDate หรือ endDate เปลี่ยน
  useEffect(() => {
    console.log('useEffect triggered with:', { startDate, endDate, deptcodesParam });
    if (startDate && endDate && deptcodesParam) {
      fetchDetails();
    }
  }, [startDate, endDate, deptcodesParam, fetchDetails]);

  // useEffect ใหม่เพื่ออัปเดต URL เมื่อ startDate หรือ endDate เปลี่ยน
  // (New useEffect to update the URL when startDate or endDate changes)
  useEffect(() => {
    if (startDate && endDate) {
      const currentSearchParams = new URLSearchParams(searchParams.toString());
      currentSearchParams.set('startDate', startDate);
      currentSearchParams.set('endDate', endDate);
      // ลบ workdate ออก เพื่อให้ URL สะอาดขึ้น
      // (Remove workdate to make the URL cleaner)
      currentSearchParams.delete('workdate');
      router.push(`/report/details?${currentSearchParams.toString()}`);
    }
  }, [startDate, endDate, router, searchParams]);

  const formatTime = (isoString: string | null): string => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) {
        return isoString.substring(0, 8);
      }
      return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch {
      console.error('Error formatting time:', isoString);
      return isoString.substring(0, 8) || '-';
    }
  };

  const getOverIn = (time: string | null) => {
    if (!time) return null;
    let timePart = '';
    try {
      const dateObj = new Date(time);
      if (!isNaN(dateObj.getTime())) {
        timePart = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      } else {
        timePart = time.substring(0, 8);
        if (timePart.length < 8) timePart += ':00';
      }
    } catch {
      timePart = time.substring(0, 8);
      if (timePart.length < 8) timePart += ':00';
    }

    const overTime = new Date(`1970-01-01T${timePart}`);
    const threshold = new Date('1970-01-01T08:00:00');

    if (overTime.getTime() > threshold.getTime()) {
      const diffMs = overTime.getTime() - threshold.getTime();
      const diffDate = new Date(diffMs);
      return diffDate.toISOString().substring(11, 19);
    } else {
      return '-';
    }
  };

  const exportToCSV = () => {
    if (details.length === 0) {
      console.log('No data to export');
      return;
    }

    const headers = ['date', 'Name-Lastname', 'time in', 'Time-out', 'over-in', 'department'];
    const rows = details.map((d) => [
      d.workdate,
      d.full_name,
      formatTime(d.firstscantime),
      formatTime(d.lastscantime),
      getOverIn(d.firstscantime) || '-',
      d.deptname,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers, ...rows].map((e) => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `report_${deptcodesParam?.replace(/,/g, '_')}_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // จัดกลุ่มข้อมูลตามวันที่และแผนก
  // (Group details by date and department)
  const groupedDetailsByDate = useMemo(() => {
    const groups: Record<string, Record<string, { scanned: Detail[], notScanned: Detail[] }>> = {};
    details.forEach(detail => {
      if (!groups[detail.workdate]) {
        groups[detail.workdate] = {};
      }
      if (!groups[detail.workdate][detail.deptcode]) {
        groups[detail.workdate][detail.deptcode] = { scanned: [], notScanned: [] };
      }
      if (detail.full_name && detail.full_name.trim() !== '') {
        if (detail.firstscantime) {
          groups[detail.workdate][detail.deptcode].scanned.push(detail);
        } else {
          groups[detail.workdate][detail.deptcode].notScanned.push(detail);
        }
      }
    });
    return groups;
  }, [details]);

  // สร้างส่วนแสดงผลสำหรับแต่ละวันและแผนก
  // (Render section for each date and department)
  const renderReportContent = useMemo(() => {
    const sortedDates = Object.keys(groupedDetailsByDate).sort();

    return sortedDates.map((workdate) => {
      const deptGroups = groupedDetailsByDate[workdate];
      const allDetailsForDate = Object.values(deptGroups).flatMap(group => [...group.scanned, ...group.notScanned]);
      const totalEmployees = allDetailsForDate.length;
      const scannedCount = allDetailsForDate.filter(d => d.firstscantime).length;
      const notScannedCount = allDetailsForDate.filter(d => !d.firstscantime).length;
      const scannedPercentage = totalEmployees > 0 ? (scannedCount / totalEmployees) * 100 : 0;
      const notScannedPercentage = totalEmployees > 0 ? (notScannedCount / totalEmployees) * 100 : 0;
      const sortedDeptcodes = Object.keys(deptGroups).sort((a, b) => deptInfo[a].localeCompare(deptInfo[b]));

      return (
        <div key={workdate} className="border-b pb-4 mb-4">
          <h3 className="text-xl font-bold mb-4">date {workdate}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 items-stretch">
            <div
              className="flex flex-col items-center justify-center bg-blue-100 text-blue-800 px-6 py-5 rounded-2xl shadow-md h-full transition-transform hover:scale-105 hover:shadow-lg cursor-pointer relative"
              title="Total Employees"
            >
              <div className="flex items-center gap-4 w-full justify-start">
                <FaUsers size={36} />
                <div className="text-left">
                  <div className="text-2xl font-extrabold">{totalEmployees}</div>
                  <div className="text-base text-blue-900 font-extrabold">All employees</div>
                </div>
              </div>
            </div>
            <div
              className="flex flex-col items-center justify-center bg-green-100 text-green-800 px-6 py-5 rounded-2xl shadow-md h-full transition-transform hover:scale-105 hover:shadow-lg cursor-pointer relative"
              title="Scanned"
            >
              <div className="flex items-center gap-4 w-full justify-start">
                <FaCheckCircle size={36} />
                <div className="text-left">
                  <div className="text-2xl font-extrabold">{scannedCount}</div>
                  <div className="text-base text-green-900 font-extrabold">Scanned</div>
                </div>
              </div>
              <div className="absolute bottom-3 right-4 text-right text-black text-sm">
                <div className='text-lg font-bold text-green-700'>{scannedPercentage.toFixed(2)}%</div>
                <div>Of all employees</div>
              </div>
            </div>
            <div
              className="flex flex-col items-center justify-center bg-red-100 text-red-800 px-6 py-5 rounded-2xl shadow-md h-full transition-transform hover:scale-105 hover:shadow-lg cursor-pointer relative"
              title="No Scan"
            >
              <div className="flex items-center gap-4 w-full justify-start">
                <FaExclamationCircle size={36} />
                <div className="text-left">
                  <div className="text-2xl font-extrabold">{notScannedCount}</div>
                  <div className="text-base text-red-900 font-extrabold">not scan</div>
                </div>
              </div>
              <div className="absolute bottom-3 right-4 text-right text-black text-sm">
                <div className='text-lg font-bold text-red-700'>{notScannedPercentage.toFixed(2)}%</div>
                <div>Of all employees</div>
              </div>
            </div>
          </div>

          {/* แสดงตาราง No Scan ทุกแผนก */}
          {sortedDeptcodes.map(deptcode => {
            const detailGroups = deptGroups[deptcode];
            const notScannedWithName = detailGroups.notScanned.filter(row => row.full_name && row.full_name.trim() !== '');
            if (notScannedWithName.length === 0) return null;
            return (
              <div key={`${workdate}-${deptcode}-no-scan`} className="mb-4">
                <h4 className="text-base font-semibold mt-2 mb-2 text-red-600">
                  No Scan : {deptInfo[deptcode]} ({notScannedWithName.length} people)
                </h4>
                <table className="min-w-full bg-white rounded shadow text-sm mb-4">
                  <thead className="bg-red-100 text-left">
                    <tr>
                      <th className="p-3">HQ Emp Id</th>
                      <th className="p-3">Emp Id</th>
                      <th className="p-3">FullName</th>
                      <th className="p-3">Division</th>
                      <th className="p-3">Section</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Shift Type</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notScannedWithName.map((row, idx) => (
                      <tr key={idx} className="hover:bg-red-50">
                        <td className="p-3">{row.person_code}</td>
                        <td className="p-3">{row.htcpersoncode}</td>
                        <td className="p-3">{row.full_name}</td>
                        <td className="p-3">{row.department_full_paths}</td>
                        <td className="p-3">{row.deptname}</td>
                        <td className="p-3">{row.PersonType}</td>
                        <td className="p-3">{row.shiftname}</td>
                        <td className="p-3">
                          <button
                            onClick={() => {
                              router.push(
                                `/report/person/${encodeURIComponent(row.person_code)}?from=${encodeURIComponent(row.workdate)}`
                              );
                            }}
                            className="cursor-pointer"
                            title="View Details"
                          >
                            <PiFileMagnifyingGlassBold size={24} className="text-blue-500 hover:text-blue-700" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* แสดงตาราง Scanned ทุกแผนก */}
          {sortedDeptcodes.map(deptcode => {
            const detailGroups = deptGroups[deptcode];
            const scannedWithName = detailGroups.scanned.filter(row => row.full_name && row.full_name.trim() !== '');
            if (scannedWithName.length === 0) return null;
            return (
              <div key={`${workdate}-${deptcode}-scanned`} className="mb-4">
                <h4 className="text-base font-semibold mt-2 mb-2 text-green-600">
                  Scanned : {deptInfo[deptcode]} ({scannedWithName.length} people)
                </h4>
                <table className="min-w-full bg-white rounded shadow text-sm">
                  <thead className="bg-green-100 text-left">
                    <tr>
                      <th className="p-3">HQ Emp Id</th>
                      <th className="p-3">Emp Id</th>
                      <th className="p-3">FullName</th>
                      <th className="p-3">Division</th>
                      <th className="p-3">Section</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Time In</th>
                      <th className="p-3">Time Out</th>
                      <th className="p-3">Over IN</th>
                      <th className="p-3">Shift Type</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scannedWithName.map((row, idx) => (
                      <tr key={idx} className="hover:bg-green-50">
                        <td className="p-3">{row.person_code}</td>
                        <td className="p-3">{row.htcpersoncode}</td>
                        <td className="p-3">{row.full_name}</td>
                        <td className="p-3">{row.department_full_paths}</td>
                        <td className="p-3">{row.deptname}</td>
                        <td className="p-3">{row.PersonType}</td>
                        <td className="p-3">{formatTime(row.firstscantime)}</td>
                        <td className="p-3">{formatTime(row.lastscantime)}</td>
                        <td className="p-3">{getOverIn(row.firstscantime) || '-'}</td>
                        <td className="p-3">{row.shiftname}</td>
                        <td className="p-3">
                          <button
                            onClick={() => {
                              router.push(
                                `/report/person/${encodeURIComponent(row.person_code)}?from=${encodeURIComponent(row.workdate)}`
                              );
                            }}
                            className="cursor-pointer"
                            title="View Details"
                          >
                            <PiFileMagnifyingGlassBold size={24} className="text-blue-500 hover:text-blue-700" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      );
    });
  }, [groupedDetailsByDate, deptInfo, router]);

  return (
    <div className="p-6 space-y-6">

      <h1 className="text-xl font-bold">Department report</h1>
      <h2 className="text-xl font-bold">{Object.values(deptInfo).join(', ')}</h2>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col items-start gap-1">
          <span className="text-gray-700 text-sm font-medium">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-slate-300 px-2 py-1 rounded-lg"
          />
        </label>
        <label className="flex flex-col items-start gap-1">
          <span className="text-gray-700 text-sm font-medium">End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-slate-300 px-2 py-1 rounded-lg"
          />
        </label>
      </div>


      {fetchError && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg shadow">
          An error occurred: {fetchError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center  bg-gray-100">
          <Spinner />
        </div>
      ) : details.length > 0 ? (
        <>
          <div className="mt-8 space-y-8">
            {renderReportContent}
          </div>

          <div className="flex items-center justify-center mt-4">
            <button
              onClick={exportToCSV}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-md"
            >
              Export CSV
            </button>
          </div>
        </>
      ) : (
        <div className="text-center text-gray-500 py-10">
          No data found for the selected date range and department
        </div>
      )}
    </div>
  );
}