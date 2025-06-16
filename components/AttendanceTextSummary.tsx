'use client';

type Props = {
  date: string;
  totalScanned: number;    
  totalNotScanned: number; 
};

const AttendanceTextSummary = ({
  date,
  totalScanned,     
  totalNotScanned, 
}: Props) => {
  const totalEmployees = totalScanned + totalNotScanned;

  return (
    <div className="text-gray-700 text-base">
      วันที่ <span className="font-semibold">{date}</span> มีพนักงานทั้งหมด{' '}
      <span className="font-semibold">
        {/* ใช้ค่า totalEmployees ที่คำนวณได้ */}
        {isNaN(totalEmployees) ? 'N/A' : totalEmployees}
      </span>{' '}
      คน,
      เข้าแล้ว{' '}
      <span className="text-green-600 font-semibold">
        {/* ใช้ค่า totalScanned */}
        {isNaN(totalScanned) ? 'N/A' : totalScanned}
      </span>{' '}
      คน,
      ยังไม่เข้า{' '}
      <span className="text-red-600 font-semibold">
        {/* ใช้ค่า totalNotScanned */}
        {isNaN(totalNotScanned) ? 'N/A' : totalNotScanned}
      </span>{' '}
      คน
    </div>
  );
};

export default AttendanceTextSummary;