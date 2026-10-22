import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Users as UsersIcon, UserPlus, Search, Building2, Droplets, CreditCard, ExternalLink } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { DailyLimitEditor } from '../components/users/DailyLimitEditor';

export const Users = () => {
  const { users, addNewUser, settings } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [hostelFilter, setHostelFilter] = useState('All'); // All | Hostel Block A | Hostel Block B | PG Block C
  const [statusFilter, setStatusFilter] = useState('All'); // All | Active | Warning | Suspended

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  // Form state
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserHostel, setNewUserHostel] = useState('Hostel Block A');
  const [newUserRoom, setNewUserRoom] = useState('A-101');
  const [newUserRfid, setNewUserRfid] = useState('');

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.rfid.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.hostelBlock.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesHostel = hostelFilter === 'All' ? true : u.hostelBlock === hostelFilter;
    const matchesStatus = statusFilter === 'All' ? true : u.status === statusFilter;

    return matchesSearch && matchesHostel && matchesStatus;
  });

  // Segregated metric calculations
  const totalWaterUsedAll = filteredUsers.reduce((acc, u) => acc + u.todayUsage, 0);
  const totalPaymentsDoneAll = filteredUsers.reduce((acc, u) => acc + u.totalSpent, 0);

  // Saves the student in the backend, so the card works at the Wokwi station right away
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserRfid) {
      toast.error('Please complete all required student fields.');
      return;
    }
    try {
      const created = await addNewUser({
        name: newUserName,
        email: newUserEmail,
        hostelBlock: newUserHostel,
        roomNo: newUserRoom,
        rfid: newUserRfid.toUpperCase()
      });
      toast.success(`${created.name} registered with card ${created.rfid} – try it in Wokwi!`);
      setIsAddUserModalOpen(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserRfid('');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-['Outfit']">Student Directory & Hostel Allocations</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Set each student's <b className="text-violet-600">daily water limit</b> in the table (default {settings.dailyLimitLiters} L from Settings).
          </p>
        </div>
        <Button
          onClick={() => setIsAddUserModalOpen(true)}
          icon={UserPlus}
          className="bg-sky-600 hover:bg-sky-500"
        >
          Add New Student
        </Button>
      </div>

      {/* 4 Summary Cards Segregated by Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Students Count</span>
            <UsersIcon className="w-4 h-4 text-sky-600" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 font-['Outfit'] mt-2">{filteredUsers.length} Students</h3>
          <p className="text-xs text-slate-500 mt-0.5">Registered RFID users</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Hostel Blocks</span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 font-['Outfit'] mt-2">
            {hostelFilter === 'All' ? '3 Blocks' : hostelFilter}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Active dispensing zones</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Total Water Used</span>
            <Droplets className="w-4 h-4 text-cyan-600" />
          </div>
          <h3 className="text-2xl font-black text-sky-600 font-['Outfit'] mt-2">{totalWaterUsedAll.toFixed(1)} L</h3>
          <p className="text-xs text-slate-500 mt-0.5">Filtered group today usage</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider">
            <span>Payments Done</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-black text-emerald-600 font-['Outfit'] mt-2">₹{totalPaymentsDoneAll.toLocaleString()}</h3>
          <p className="text-xs text-slate-500 mt-0.5">Total spent by group</p>
        </div>
      </div>

      {/* Controls Bar: Search, Hostel Filter, and Status Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name, hostel, RFID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Hostel Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Hostel:</span>
            <select
              value={hostelFilter}
              onChange={(e) => setHostelFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold text-slate-800"
            >
              <option value="All">All Hostel Blocks</option>
              <option value="Hostel Block A">Hostel Block A</option>
              <option value="Hostel Block B">Hostel Block B</option>
              <option value="PG Block C">PG Block C</option>
            </select>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-xl text-xs font-semibold">
            {['All', 'Active', 'Warning', 'Suspended'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Segregated Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Student Name</th>
                <th>Hostel Block & Room</th>
                <th>RFID UID Tag</th>
                <th>Water Used (Today / Monthly)</th>
                <th>Daily Limit</th>
                <th>Payments Done</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400">
                    No matching students found for selected hostel filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((usr) => (
                  <tr key={usr.id}>
                    <td className="font-mono font-bold text-sky-600">{usr.id}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <img
                          src={usr.avatar}
                          alt={usr.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <p className="font-bold text-slate-900 leading-tight">{usr.name}</p>
                          <p className="text-[11px] text-slate-500">{usr.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-800 block text-xs">{usr.hostelBlock}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Room: {usr.roomNo}</span>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-slate-700 font-semibold">{usr.rfid}</td>
                    <td>
                      <div>
                        <span className="font-bold text-sky-600 block text-xs">{usr.todayUsage} L today</span>
                        <span className="text-[10px] text-slate-500">{usr.monthlyUsage} L this month</span>
                      </div>
                    </td>
                    <td>
                      <DailyLimitEditor user={usr} compact />
                    </td>
                    <td>
                      <div>
                        <span className="font-bold text-emerald-600 block text-xs">₹{usr.totalSpent} spent</span>
                        <span className="text-[10px] text-slate-500">via Razorpay</span>
                      </div>
                    </td>
                    <td>
                      <Badge
                        variant={usr.status === 'Active' ? 'success' : usr.status === 'Warning' ? 'warning' : 'danger'}
                      >
                        {usr.status}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/users/${usr.id}`}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Full Student Details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Modal */}
      <Modal isOpen={isAddUserModalOpen} onClose={() => setIsAddUserModalOpen(false)} title="Register Student & Hostel Allocation">
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Student Full Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Suresh Kumar"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hostel Block</label>
              <select
                value={newUserHostel}
                onChange={(e) => setNewUserHostel(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="Hostel Block A">Hostel Block A</option>
                <option value="Hostel Block B">Hostel Block B</option>
                <option value="PG Block C">PG Block C</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Room Number</label>
              <input
                type="text"
                required
                placeholder="A-101"
                value={newUserRoom}
                onChange={(e) => setNewUserRoom(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="suresh@example.com"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">RFID Tag UID (Hex)</label>
            <input
              type="text"
              required
              placeholder="e.g. 04:11:22:33:44:55:66 (Wokwi NFC tag)"
              value={newUserRfid}
              onChange={(e) => setNewUserRfid(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-mono uppercase border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setIsAddUserModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Student Account</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default Users;
