// ============================================================
// Main Application Shell Layout
// ============================================================

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '@/components/common/Navbar';
import { Sidebar } from '@/components/common/Sidebar';
import { ClockDebugger } from '@/components/common/ClockDebugger';

export const AppLayout: React.FC = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar
        onMobileToggle={() => setIsMobileOpen(!isMobileOpen)}
        isMobileOpen={isMobileOpen}
      />

      <div className="flex flex-1">
        <Sidebar
          isOpen={isMobileOpen}
          onClose={() => setIsMobileOpen(false)}
        />

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Floating Clock Widget for Deadline Simulation */}
      <ClockDebugger />
    </div>
  );
};
