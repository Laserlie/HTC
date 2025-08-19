"use client";

import React, { useState, useMemo, useEffect } from 'react';
//import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';

// Interfaces for data structure
interface Employee {
    id: string;
    name: string;
    department: string;
    departmentName: string;
    deptCode: string;
    hours: number[]; // Contains w1-w5 data
    currentUsedHours: number;
    hoursLeft: number;
}

// Interface for the hours API data
interface EmployeeHoursApiRawData {
    div: string;
    sec: string;
    empid: string;
    w1: number;
    w2: number;
    w3: number;
    w4: number;
    w5: number;
    current_date_use_hour: number;
    hours_left: number;
}

// Interface for the employee details API data
interface EmployeeDetailsApiRawData {
    workdayId: string;
    empCode: string;
    empName: string;
    deptCode: string;
    deptName: string;
}

// Helper function to parse department code string
const parseDeptCode = (deptCode: string) => {
    if (deptCode?.length !== 8) {
        return { factory: '', division: '', department: '', subUnit: '' };
    }
    const factory = deptCode.substring(0, 2);
    const division = deptCode.substring(2, 4);
    const department = deptCode.substring(4, 6);
    const subUnit = deptCode.substring(6, 8);
    return { factory, division, department, subUnit };
};

const Report2: React.FC = () => {
    // State to manage filters
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [factoryFilter, setFactoryFilter] = useState<string>('');
    const [divisionFilter, setDivisionFilter] = useState<string>('');
    const [departmentFilter, setDepartmentFilter] = useState<string>('');
    
    // State for pagination
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(20);

    // State for fetched employee data
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [loadingData, setLoadingData] = useState<boolean>(false);

    // State for week filter
    const [weekFilter, setWeekFilter] = useState<number>(0);

    // useEffect to fetch data from two APIs and merge them
    useEffect(() => {
        setLoadingData(true);

        const fetchEmployeeHours = fetch(`http://10.35.10.47:2007/api/LineUsers/GetEmployeeHours`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            });

        const fetchEmployeeDetails = fetch(`http://10.35.10.47:2007/api/LineNotify/EmployeeActive`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            });

        Promise.all([fetchEmployeeHours, fetchEmployeeDetails])
            .then(([hoursData, detailsData]: [EmployeeHoursApiRawData[], EmployeeDetailsApiRawData[]]) => {
                if (Array.isArray(hoursData) && Array.isArray(detailsData)) {
                    // Create a map for quick lookup of employee details by workdayId/empid
                    const employeeDetailsMap = new Map<string, EmployeeDetailsApiRawData>();
                    detailsData.forEach(item => {
                        employeeDetailsMap.set(item.workdayId, item);
                    });

                    // Map the hours data, combining with details data
                    const formattedEmployees: Employee[] = hoursData.map(hoursItem => {
                        const detailsItem = employeeDetailsMap.get(hoursItem.empid);
                        const empName = detailsItem?.empName || hoursItem.empid;
                        const deptName = detailsItem?.deptName || `${hoursItem.div}-${hoursItem.sec}`;
                        const deptCode = detailsItem?.deptCode || '00000000';

                        return {
                            id: hoursItem.empid,
                            name: empName,
                            department: hoursItem.div,
                            departmentName: deptName,
                            deptCode: deptCode,
                            hours: [hoursItem.w1, hoursItem.w2, hoursItem.w3, hoursItem.w4, hoursItem.w5],
                            currentUsedHours: hoursItem.current_date_use_hour,
                            hoursLeft: hoursItem.hours_left,
                        };
                    });
                    setAllEmployees(formattedEmployees);
                } else {
                    console.warn('รูปแบบข้อมูลไม่ถูกต้อง: ข้อมูลไม่ใช่ Array');
                    setAllEmployees([]);
                }
            })
            .catch(err => {
                console.error('เกิดข้อผิดพลาดในการดึงข้อมูล:', err);
                setAllEmployees([]);
            })
            .finally(() => {
                setLoadingData(false);
            });
    }, []);

    // Memoized filtered data to avoid re-calculating on every render
    const filteredEmployees = useMemo(() => {
        return allEmployees.filter(employee => {
            const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) || employee.id.toLowerCase().includes(searchTerm.toLowerCase());
            
            let matchesStatus = true;
            const weekIndex = weekFilter - 1; // Adjust for 0-based array index

            if (statusFilter && weekFilter > 0) {
                const hour = employee.hours[weekIndex] || 0;
                matchesStatus = (statusFilter === 'overtime' && hour > 60) || (statusFilter === 'normal' && hour <= 60 && hour > 0);
            } else if (statusFilter && weekFilter === 0) {
                matchesStatus = employee.hours.some(hour =>
                    (statusFilter === 'overtime' && hour > 60) || (statusFilter === 'normal' && hour <= 60 && hour > 0)
                );
            }
            
            // Hierarchical filter logic - Corrected to use deptCode
            const { factory, division } = parseDeptCode(employee.deptCode);
            const matchesFactory = !factoryFilter || (factory === factoryFilter);
            const matchesDivision = !divisionFilter || (factory === factoryFilter && division === divisionFilter);
            const matchesDepartment = !departmentFilter || (employee.deptCode === departmentFilter);

            return matchesSearch && matchesStatus && matchesFactory && matchesDivision && matchesDepartment;
        });
    }, [searchTerm, statusFilter, factoryFilter, divisionFilter, departmentFilter, allEmployees, weekFilter]);

    // Memoized unique options for each dropdown
    const factoryOptions = useMemo(() => {
        const options = new Map<string, string>();
        allEmployees.forEach(emp => {
            const { factory } = parseDeptCode(emp.deptCode);
            if (factory && !options.has(factory)) {
                 // Use the full department name as the name for the factory code
                options.set(factory, emp.departmentName);
            }
        });
        return Array.from(options.entries()).map(([code, name]) => ({ code, name }));
    }, [allEmployees]);

    const divisionOptions = useMemo(() => {
        const options = new Map<string, string>();
        allEmployees.forEach(emp => {
            const { factory, division } = parseDeptCode(emp.deptCode);
            if (factory === factoryFilter && division && division !== '00' && !options.has(division)) {
                // Use the full department name as the name for the division code
                options.set(division, emp.departmentName);
            }
        });
        return Array.from(options.entries()).map(([code, name]) => ({ code, name }));
    }, [allEmployees, factoryFilter]);
    
    // Updated to return a list of unique department names, linked to their codes
    const departmentOptions = useMemo(() => {
        const uniqueDepartments = new Map<string, { code: string; name: string }>();
        allEmployees.forEach(emp => {
            const { factory, division } = parseDeptCode(emp.deptCode);
            if (factory === factoryFilter && division === divisionFilter && emp.departmentName) {
                // Use the department name as the key to ensure uniqueness
                uniqueDepartments.set(emp.departmentName, { code: emp.deptCode, name: emp.departmentName });
            }
        });
        // Convert the map values to an array and sort by name
        return Array.from(uniqueDepartments.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [allEmployees, factoryFilter, divisionFilter]);

    // Memoized paginated data to display
    const paginatedEmployees = useMemo(() => {
        const indexOfLastRow = currentPage * rowsPerPage;
        const indexOfFirstRow = indexOfLastRow - rowsPerPage;
        return filteredEmployees.slice(indexOfFirstRow, indexOfLastRow);
    }, [filteredEmployees, currentPage, rowsPerPage]);

    // Summary data calculations - Updated to respect week filter
    const summaryData = useMemo(() => {
        const totalEmployees = filteredEmployees.length;
        let overtimeEmployees = 0;
        let normalEmployees = 0;

        if (weekFilter > 0) {
            const weekIndex = weekFilter - 1;
            overtimeEmployees = filteredEmployees.filter(emp => (emp.hours[weekIndex] || 0) > 60).length;
            normalEmployees = filteredEmployees.filter(emp => (emp.hours[weekIndex] || 0) <= 60 && (emp.hours[weekIndex] || 0) > 0).length;
        } else {
            overtimeEmployees = filteredEmployees.filter(emp => emp.hours.some(h => h > 60)).length;
            normalEmployees = totalEmployees - overtimeEmployees;
        }
        
        return { totalEmployees, normalEmployees, overtimeEmployees };
    }, [filteredEmployees, weekFilter]);

    const handleExportToCSV = () => {
        // Dynamic headers based on weekFilter
        let headers = ['รหัส', 'ชื่อ-นามสกุล', 'แผนก'];
        if (weekFilter === 0) {
            headers = [...headers, 'Week1', 'Week2', 'Week3', 'Week4', 'Week5', 'ทำงานไปแล้ว (Weekล่าสุด)', 'เหลือชั่วโมงทำงาน (Weekล่าสุด)'];
        } else {
            headers = [...headers, `Week ${weekFilter}`, 'ทำงานไปแล้ว', 'เหลือชั่วโมงทำงาน'];
        }

        const csvContent = [
            headers.join(','),
            ...filteredEmployees.map(emp => {
                let rowData = [
                    emp.id,
                    `"${emp.name}"`,
                    `"${emp.departmentName}"`,
                ];
                if (weekFilter === 0) {
                    // Export all weeks if no specific week is filtered
                    const latestWeekIndex = emp.hours.length - 1 - [...emp.hours].reverse().findIndex(hour => hour > 0);
                    const latestUsedHours = latestWeekIndex !== -1 ? emp.hours[latestWeekIndex] : 0;
                    const hoursLeftCalculated = 60 - latestUsedHours; // Assuming 60 hours is the maximum
                    
                    rowData = [...rowData, ...emp.hours.map(String), String(latestUsedHours), String(hoursLeftCalculated)];
                } else {
                    // Export only the selected week's data
                    const selectedWeekHours = emp.hours[weekFilter - 1] || 0;
                    const hoursLeftCalculated = 60 - selectedWeekHours;
                    rowData = [...rowData, String(selectedWeekHours), String(selectedWeekHours), String(hoursLeftCalculated)];
                }
                return rowData.join(',');
            })
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'รายงานการทำงาน_สัปดาห์.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Searching with filters:', {
            searchTerm,
            statusFilter,
            factoryFilter,
            divisionFilter,
            departmentFilter,
            weekFilter
        });
        setCurrentPage(1);
    };
    
    // Handlers for pagination
    const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setRowsPerPage(Number(e.target.value));
        setCurrentPage(1); // Reset to the first page when the row count changes
    };

    return (
        <div className="container mx-auto px-4 py-4">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-700 mb-2 ">รายงานการทำงานพนักงานประจำเดือน {new Date().toLocaleString('th-TH', { year: 'numeric', month: 'long' })}</h1>
                        <p className="text-gray-600">ชั่วโมงการทำงาน - รายสัปดาห์</p>
                    </div>
                </div>
            </div>

            {/* Filter and Search */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 flex-wrap">
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อหรือรหัสพนักงาน..."
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 flex-grow"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select
                        id="statusFilter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">สถานะทั้งหมด</option>
                        <option value="noral">ปกติ (≤ 60 ชม.)</option>
                        <option value="overtime">เกินเวลา (&gt; 60 ชม.)</option>
                    </select>
                    {/* Week Filter Dropdown */}
                    <select
                        id="weekFilter"
                        value={weekFilter}
                        onChange={e => setWeekFilter(Number(e.target.value))}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value={0}>ทุกสัปดาห์</option>
                        <option value={1}>Week 1</option>
                        <option value={2}>Week 2</option>
                        <option value={3}>Week 3</option>
                        <option value={4}>Week 4</option>
                        <option value={5}>Week 5</option>
                    </select>
                    {/* Updated Factory dropdown to show names */}
                    <select
                        id="factoryFilter"
                        value={factoryFilter}
                        onChange={(e) => {
                            setFactoryFilter(e.target.value);
                            setDivisionFilter('');
                            setDepartmentFilter('');
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="">โรงงานทั้งหมด</option>
                        {factoryOptions.map(option => (
                            <option key={option.code} value={option.code}>{option.name}</option>
                        ))}
                    </select>
                    {/* Updated Division dropdown to show names */}
                    <select
                        id="divisionFilter"
                        value={divisionFilter}
                        onChange={(e) => {
                            setDivisionFilter(e.target.value);
                            setDepartmentFilter('');
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        disabled={!factoryFilter}
                    >
                        <option value="">ฝ่ายทั้งหมด</option>
                        {divisionOptions.map(option => (
                            <option key={option.code} value={option.code}>{option.name}</option>
                        ))}
                    </select>
                    {/* The department filter is updated to ensure unique names */}
                    <select
                        id="departmentFilter"
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        disabled={!divisionFilter}
                    >
                        <option value="">แผนกทั้งหมด</option>
                        {departmentOptions.map((option, idx) => (
                            <option key={`${option.code}-${idx}`} value={option.code}>{option.name}</option>
                        ))}
                    </select>

                    <button
                        type="submit"
                        className="bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-900 flex items-center justify-center min-w-[100px]"
                        disabled={loadingData}
                    >
                        ค้นหา
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" fill="none"/>
                            <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </button>
                </form>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
                {/* Card 1: Total Employees */}
                <div className="bg-blue-100 rounded-xl shadow-md p-6 ">
                    <div className="flex items-center">
                        <div className="p-3 bg-blue-200 rounded-full  ">
                            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                            </svg>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-blue-800">พนักงานทั้งหมด</p>
                            <p className="text-3xl font-bold text-blue-800">{summaryData.totalEmployees} คน</p>
                        </div>
                    </div>
                </div>
                {/* Card 2: Normal Employees */}
                <div className="bg-green-100 rounded-xl shadow-md p-6">
                    <div className="flex items-center">
                        <div className="p-3 bg-green-100 rounded-full">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-green-800">ปกติ (≤ 60 ชม.)</p>
                            <p className="text-3xl font-bold text-green-700">{summaryData.normalEmployees} คน</p>
                        </div>
                    </div>
                </div>
                {/* Card 3: Overtime Employees */}
                <div className="bg-red-100 rounded-xl shadow-md p-6 ">
                    <div className="flex items-center">
                        <div className="p-3 bg-red-100 rounded-full">
                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                            </svg>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm text-red-500">เกิน 60 ชม. ในสัปดาห์</p>
                            <p className="text-3xl font-bold text-red-600">{summaryData.overtimeEmployees} คน</p>
                        </div>
                    </div>
                </div>
            </div>

            {loadingData && (
                <div className="p-8 text-center text-gray-500">
                    <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p>กำลังโหลดข้อมูล...</p>
                </div>
            )}
            
            {/* Employee Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="px-6 py-4 bg-blue-700 border-b flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">รายละเอียดการทำงานของพนักงาน</h2>
                    
                    {/* Rows per page dropdown moved here */}
                    <div className="flex items-center space-x-2">
                        <span className="text-sm text-white">แสดง </span>
                        <select
                            value={rowsPerPage}
                            onChange={handleRowsPerPageChange}
                            className="px-3 py-1 border rounded-lg bg-white text-gray-900"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={40}>50</option>
                            <option value={100}>100</option>
                            <option value={filteredEmployees.length}>ทั้งหมด</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-6 py-3 text-left text-s font-medium text-gray-600 uppercase tracking-wider w-1/12">รหัส</th>
                                <th className="px-6 py-3 text-left text-s font-medium text-gray-600 uppercase tracking-wider w-2/12">แผนก</th>
                                <th className="px-6 py-3 text-left text-s font-medium text-gray-600 uppercase tracking-wider w-2/12">ชื่อ-นามสกุล</th>
                                {[1, 2, 3, 4, 5].map((weekNum) => (
                                    <th 
                                        key={`week-header-${weekNum}`}
                                        className={`px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider ${weekFilter === weekNum ? 'bg-indigo-100' : ''}`}
                                    >
                                        Week {weekNum}
                                    </th>
                                ))}
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    ทำงานไปแล้ว <br/> ({weekFilter === 0 ? 'Weekล่าสุด' : `Week ${weekFilter}`})
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    เหลือชั่วโมงทำงาน <br/> ({weekFilter === 0 ? 'Weekล่าสุด' : `Week ${weekFilter}`})
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {paginatedEmployees.length > 0 ? (
                                paginatedEmployees.map(employee => {
                                    // Logic to find the latest week or use the filtered week
                                    const latestWeekIndex = weekFilter > 0 ? weekFilter - 1 : employee.hours.length - 1 - [...employee.hours].reverse().findIndex(hour => hour > 0);
                                    const latestUsedHours = latestWeekIndex !== -1 ? (employee.hours[latestWeekIndex] || 0) : 0;
                                    const hoursLeftCalculated = 60 - latestUsedHours; // Assuming 60 hours is the maximum

                                    return (
                                        <tr key={employee.id} className={'hover:bg-gray-50'}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 w-1/12">{employee.id}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 w-2/12">{employee.departmentName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 w-2/12">{employee.name}</td>
                                            {employee.hours.map((hour, index) => {
                                                const weekNum = index + 1;
                                                let cellColorClass = 'text-gray-900';
                                                if (hour > 60) {
                                                    cellColorClass = 'text-red-600 font-semibold';
                                                } else if (hour <= 60 && hour > 0) {
                                                    cellColorClass = 'text-green-600';
                                                } else if (hour === 0) {
                                                    cellColorClass = 'text-black';
                                                }

                                                // Highlight the cell if it's the selected week
                                                const highlightClass = weekFilter === weekNum ? 'bg-indigo-50' : '';

                                                return (
                                                    <td key={index} className={`px-6 py-4 whitespace-nowrap text-sm text-center ${cellColorClass} ${highlightClass}`}>
                                                        {hour}
                                                    </td>
                                                );
                                            })}
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-center ${latestUsedHours > 60 ? 'text-red-600 font-semibold' : 'text-green-600'}`}>{latestUsedHours}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">{hoursLeftCalculated}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Page navigation buttons - remain at the bottom */}
                <div className="flex justify-end items-center bg-gray-100 p-4 ">
                    <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-700">หน้า {currentPage} จาก {Math.ceil(filteredEmployees.length / rowsPerPage)}</span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 border rounded-lg disabled:opacity-50 shadow-sm"
                        >
                            ก่อนหน้า
                        </button>
                        <button
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            disabled={currentPage >= Math.ceil(filteredEmployees.length / rowsPerPage)}
                            className="px-3 py-1 border rounded-lg disabled:opacity-50 shadow-sm"
                        >
                            ถัดไป
                        </button>
                    </div>
                </div>
            </div>

            {/* Export Button */}
            <div className="mt-8 text-center">
                <button
                    onClick={handleExportToCSV}
                    className="bg-blue-600 hover:bg-blue-900 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition duration-300"
                >
                    <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    Export CSV
                </button>
            </div>
        </div>
    );
};

export default Report2;