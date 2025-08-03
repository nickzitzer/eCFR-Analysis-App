import React, { useState } from 'react';
import { InfoIcon } from '@/components/Icons';

interface TooltipProps {
  text: React.ReactNode;
}

const InfoTooltip: React.FC<TooltipProps> = ({ text }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative flex items-center">
      <button
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        className="ml-2 text-gray-500 hover:text-gray-700 focus:outline-none"
        aria-label="More info"
      >
        <InfoIcon className="h-4 w-4" />
      </button>
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-800 text-white text-sm rounded-lg shadow-lg p-3 z-10">
          {text}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
};

export default InfoTooltip;
