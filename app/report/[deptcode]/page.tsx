'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PiSpinnerGapBold } from 'react-icons/pi';
import { ArrowLeft } from 'lucide-react';
import { FaCheckCircle, FaExclamationCircle, FaUsers } from 'react-icons/fa';

type Detail = {
  person_code: string;
  deptcode: string;
  full_name: string;
  department_full_paths: string;
  deptname: string;
  PersonType: string;
  firstscantime: string | null;
  lastscantime: string | null;
  shiftname: string;
};

export default function ReportDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const deptcode = params.deptcode as string;
  const initialWorkdate = searchParams.get('workdate') || '';

  const [from, setFrom] = useState(initialWorkdate);
  const [details, setDetails] = useState<Detail[]>([]);
  const [deptName, setDeptName] = useState('');
  const [loading, setLoading] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const isValidDate = (dateStr: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr).getTime());

  const goBack = () => {
    router.back();
  };

  useEffect(() => {
    const invalidDept = !deptcode || deptcode === 'undefined' || deptcode === '';
    const invalidFromDate = !from || !isValidDate(from);

    if (invalidDept || invalidFromDate) {
      if (invalidDept) {
        console.error('รหัสแผนกไม่ถูกต้อง:', deptcode);
      }
      if (invalidFromDate) {
        console.error('วันที่เริ่มต้นไม่ถูกต้อง:', from);
      }
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      const searchParamsForApi = new URLSearchParams();
      searchParamsForApi.append('from', from);
      searchParamsForApi.append('deptcode', deptcode);

      try {
        const res = await fetch(`/api/attendance/report/detail?${searchParamsForApi.toString()}`);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to fetch report detail data');
        }
        const data = await res.json();
        const sortedDetails = (data.detil || []).sort((a: Detail, b: Detail) => {
          return a.person_code.localeCompare(b.person_code, undefined, { numeric: true });
        });
        setDetails(sortedDetails);
        setDeptName(data.deptname || 'ไม่พบชื่อแผนก');
      } catch (err) {
        console.error('เกิดข้อผิดพลาด:', err);
        setDetails([]);
        setDeptName('เกิดข้อผิดพลาด');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [deptcode, from]);

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

  const exportToCSV = () => {
    if (details.length === 0) {
      console.log('ไม่มีข้อมูลให้ Export');
      return;
    }

    const headers = ['ชื่อ-สกุล', 'เวลาเข้า', 'เวลาออก', 'over-in'];
    const rows = details.map((d) => [
      d.full_name,
      formatTime(d.firstscantime),
      formatTime(d.lastscantime),
      getOverIn(d.firstscantime) || '-',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers, ...rows].map((e) => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `report_${deptName}_${from}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const initialInvalidDept = !deptcode || deptcode === 'undefined' || deptcode === '';
  const initialInvalidWorkdate = !initialWorkdate || !isValidDate(initialWorkdate);

  if (initialInvalidDept) {
    return <div className="p-6 text-red-600">รหัสแผนกไม่ถูกต้อง หรือไม่พบข้อมูลสำหรับแผนกนี้</div>;
  }
  if (initialInvalidWorkdate) {
    return <div className="p-6 text-red-600">รูปแบบวันที่ไม่ถูกต้อง</div>;
  }

  const notScannedDetails = details.filter((d) => !d.firstscantime);
  const scannedDetails = details.filter((d) => d.firstscantime);

  const paginatedNotScanned = notScannedDetails.slice(0, rowsPerPage);
  const paginatedScanned = scannedDetails.slice(0, rowsPerPage);

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(Number(e.target.value));
  };

  return (
    <div className="p-6 space-y-6">
      <button
        onClick={goBack}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-shadow shadow-md hover:shadow-lg"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back</span>
      </button>

      <h1 className="text-2xl font-bold">Department : {deptName}</h1>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-row items-center gap-2">
          <span className="text-gray-700 text-sm font-medium">Date :</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-slate-300 px-2 py-1 rounded"
          />
        </label>
      </div>

     <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 items-stretch">

  <div className="flex flex-col items-center justify-center bg-blue-100 text-blue-800 px-6 py-5 rounded-2xl shadow-md h-full">
    <div className="flex items-center gap-4">
      <FaUsers size={36} />
      <div className="text-left">
        <div className="text-2xl font-extrabold">{details.length}</div>
        <div className="text-base text-blue-900 font-medium">Total</div>
      </div>
    </div>
  </div>

  <div className="flex flex-col items-center justify-center bg-green-100 text-green-800 px-6 py-5 rounded-2xl shadow-md h-full">
    <div className="flex items-center gap-4">
      <FaCheckCircle size={36} />
      <div className="text-left">
        <div className="text-2xl font-extrabold">{scannedDetails.length}</div>
        <div className="text-base text-green-900 font-medium">Scan</div>
      </div>
    </div>
  </div>

  <div className="flex flex-col items-center justify-center bg-red-100 text-red-800 px-6 py-5 rounded-2xl shadow-md h-full">
    <div className="flex items-center gap-4">
      <FaExclamationCircle size={36} />
      <div className="text-left">
        <div className="text-2xl font-extrabold">{notScannedDetails.length}</div>
        <div className="text-base text-red-900 font-medium">No Scan</div>
      </div>
    </div>
  </div>
</div>

      {loading ? (
        <div className="flex justify-center py-10 text-gray-500 animate-spin">
          <PiSpinnerGapBold size={36} className="text-primary" />
        </div>
      ) : (
        <>
          {notScannedDetails.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mt-6">No Scan</h2>
              <table className="min-w-full bg-white rounded shadow text-sm mb-6">
                <thead className="bg-red-100 text-left">
                  <tr>
                    <th className="p-3">Emp Id</th>
                    <th className="p-3">Deptcode</th>
                    <th className="p-3">FullName</th>
                    <th className="p-3">Division</th>
                    <th className="p-3">Section</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Time In</th>
                    <th className="p-3">Time Out</th>
                    <th className="p-3">Over IN</th>
                    <th className="p-3">Shift Type</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedNotScanned.map((row, idx) => (
                    <tr
                      key={idx}
                      className="cursor-pointer hover:bg-blue-50"
                      onClick={() => {
                        router.push(
                          `/report/person/${encodeURIComponent(row.person_code)}?from=${encodeURIComponent(from)}`
                        );
                      }}
                    >
                      <td className="p-3">{row.person_code}</td>
                      <td className="p-3">{row.deptcode}</td>
                      <td className="p-3">{row.full_name}</td>
                      <td className="p-3">{row.department_full_paths}</td>
                      <td className="p-3">{row.deptname}</td>
                      <td className="p-3">{row.PersonType}</td>
                      <td className="p-3">{formatTime(row.firstscantime)}</td>
                      <td className="p-3">{formatTime(row.lastscantime)}</td>
                      <td className="p-3">{getOverIn(row.firstscantime) || '-'}</td>
                      <td className="p-3">{row.shiftname}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {scannedDetails.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mt-6">Scanned</h2>
              <table className="min-w-full bg-white rounded shadow text-sm">
                <thead className="bg-green-100 text-left">
                  <tr>
                    <th className="p-3">Emp Id</th>
                    <th className="p-3">Deptcode</th>
                    <th className="p-3">FullName</th>
                    <th className="p-3">Division</th>
                    <th className="p-3">Section</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Time In</th>
                    <th className="p-3">Time Out</th>
                    <th className="p-3">Over IN</th>
                    <th className="p-3">Shift Type</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedScanned.map((row, idx) => (
                    <tr
                      key={idx}
                      className="cursor-pointer hover:bg-blue-50"
                      onClick={() => {
                        router.push(
                          `/report/person/${encodeURIComponent(row.person_code)}?from=${encodeURIComponent(from)}`
                        );
                      }}
                    >
                      <td className="p-3">{row.person_code}</td>
                      <td className="p-3">{row.deptcode}</td>
                      <td className="p-3">{row.full_name}</td>
                      <td className="p-3">{row.department_full_paths}</td>
                      <td className="p-3">{row.deptname}</td>
                      <td className="p-3">{row.PersonType}</td>
                      <td className="p-3">{formatTime(row.firstscantime)}</td>
                      <td className="p-3">{formatTime(row.lastscantime)}</td>
                      <td className="p-3">{getOverIn(row.firstscantime) || '-'}</td>
                      <td className="p-3">{row.shiftname}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {details.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
              <label htmlFor="rows-per-page-bottom" className="text-sm font-medium text-gray-700">
                Rows per page:
              </label>
              <select
                id="rows-per-page-bottom"
                value={rowsPerPage}
                onChange={handleRowsPerPageChange}
                className="border border-slate-300 px-2 py-1 rounded"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={details.length}>All</option>
              </select>

              <button
                onClick={exportToCSV}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Export CSV
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}