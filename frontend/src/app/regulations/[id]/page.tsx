"use client";

import React from 'react';
import RegulationDetail from '../../../components/RegulationDetail';
import FloatingChatbot from '../../../components/FloatingChatbot';

// Mock data for a single regulation detail
const mockRegulationDetail = {
  id: 2,
  title: '29 CFR Part 1910 - Occupational Safety and Health Standards',
  agency: 'Occupational Safety and Health Administration (OSHA)',
  text: "This part contains the occupational safety and health standards for all industries...",
  analysis: {
      word_count: 85000,
      complexity_score: 65.2,
      amendment_frequency: 12,
      keywords: [{ word: 'Safety', count: 230 }, { word: 'Standard', count: 180 }, { word: 'Employer', count: 155 }],
  }
};

const RegulationDetailPage = () => {
  // The 'id' from params would be used to fetch real data in a production application.
  // For now, we'll use the mock data.
  const regulation = mockRegulationDetail;

  return (
    <div className="min-h-screen bg-gray-50">
      <header role="banner" className="bg-primary text-white p-4 shadow-md flex justify-between items-center">
          <h1 className="text-2xl font-bold">Federal Regulation Analysis Tool</h1>
          <nav className="flex items-center space-x-2">
              {/* Navigation buttons for Explorer and Dashboard would go here if this page was part of the main app flow */}
              <span className="px-4 py-2 rounded-md font-semibold">Regulation Detail</span>
          </nav>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:right-4 bg-accent text-primary font-bold p-2 rounded-md">Skip to Main Content</a>
      </header>

      <RegulationDetail regulation={regulation} onBack={() => window.history.back()} />

      <FloatingChatbot context={regulation.title} />

      <footer className="text-center p-4 mt-8 text-gray-500 text-sm border-t">
          <p>U.S. Federal Government | This is a demonstration application.</p>
      </footer>
    </div>
  );
};

export default RegulationDetailPage;
