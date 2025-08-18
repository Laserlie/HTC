'use client';

import { FaCheckCircle, FaExclamationCircle, FaUsers } from 'react-icons/fa';
import Link from 'next/link';
import React from 'react';

type Props = {
  totalScanned: number;
  totalNotScanned: number;
  from: string;
  to: string;
  deptCode: string;
};

const AttendanceCardSummary = ({ totalScanned, totalNotScanned, from, to, deptCode }: Props) => {
  const totalEmployees = totalScanned + totalNotScanned;

  const scannedPercentage = totalEmployees > 0 ? (totalScanned / totalEmployees) * 100 : 0;
  const notScannedPercentage = totalEmployees > 0 ? (totalNotScanned / totalEmployees) * 100 : 0;

  const createReportLink = (status: 'all' | 'scanned' | 'not_scanned') => {
    const params = new URLSearchParams();
    params.append('status', status);
    params.append('from', from);
    params.append('to', to);
    params.append('deptcode', deptCode);
    return `/report/ScanNoscanReport?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 items-stretch">
        <Link href={createReportLink('all')} passHref className="!no-underline">
          <div
            className="flex flex-col items-center justify-center bg-blue-100 text-blue-800 px-6 py-5 rounded-xl shadow-md h-full transition-transform hover:scale-105 hover:shadow-lg cursor-pointer relative"
            title="คลิกเพื่อดูเพิ่มเติม"
          >
            <div className="flex items-center gap-4 w-full justify-start">
              <FaUsers size={36} />
              <div className="text-left">
                <div className="text-2xl font-extrabold">{totalEmployees}</div>
                <div className="text-base text-blue-900 font-extrabold">Total</div>
              </div>
            </div>
            <div className="absolute bottom-3 right-4 text-right text-black text-sm">
            </div>
          </div>
        </Link>

        <Link href={createReportLink('scanned')} passHref className="!no-underline">
          <div
            className="flex flex-col items-center justify-center bg-green-100 text-green-800 px-6 py-5 rounded-xl shadow-md h-full transition-transform hover:scale-105 hover:shadow-lg cursor-pointer relative"
            title="คลิกเพื่อดูเพิ่มเติม"
          >
            <div className="flex items-center gap-4 w-full justify-start">
              <FaCheckCircle size={36} />
              <div className="text-left">
                <div className="text-2xl font-extrabold">{totalScanned}</div>
                <div className="text-base text-green-900 font-extrabold">Scan</div>
              </div>
            </div>
            <div className="absolute bottom-3 right-4 text-right text-black text-sm">
              <div className='text-lg font-bold text-green-700'>{scannedPercentage.toFixed(2)}%</div>
              <div>ของพนักงานทั้งหมด</div>
            </div>
          </div>
        </Link>

        <Link href={createReportLink('not_scanned')} passHref className="!no-underline">
          <div
            className="flex flex-col items-center justify-center bg-red-100 text-red-800 px-6 py-5 rounded-xl shadow-md h-full transition-transform hover:scale-105 hover:shadow-lg cursor-pointer relative"
            title="คลิกเพื่อดูเพิ่มเติม"
          >
            <div className="flex items-center gap-4 w-full justify-start">
              <FaExclamationCircle size={36} />
              <div className="text-left">
                <div className="text-2xl font-extrabold">{totalNotScanned}</div>
                <div className="text-base text-red-900 font-extrabold">No Scan</div>
              </div>
            </div>
            <div className="absolute bottom-3 right-4 text-right text-black text-sm">
              <div className='text-lg font-bold text-red-700'>{notScannedPercentage.toFixed(2)}%</div>
              <div>ของพนักงานทั้งหมด</div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default AttendanceCardSummary;