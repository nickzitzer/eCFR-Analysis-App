"use client";

import React, { useState } from 'react';
import { Agency } from '@/app/data';
import { ChevronDownIcon, ChevronRightIcon } from '@/components/Icons';

interface CollapsibleFilterProps {
    agencies: Agency[];
    onAgencySelect: (agencyId: number | null) => void;
}

const AgencyItem: React.FC<{ agency: Agency; onAgencySelect: (agencyId: number | null) => void; }> = ({ agency, onAgencySelect }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleToggle = () => {
        setIsOpen(!isOpen);
    };

    const handleSelect = () => {
        onAgencySelect(agency.id);
    };

    return (
        <div>
            <div className="flex items-center">
                <button onClick={handleToggle} className="mr-2">
                    {agency.children && agency.children.length > 0 ? (
                        isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />
                    ) : null}
                </button>
                <a href="#" onClick={handleSelect} className="text-primary hover:underline">{agency.name}</a>
            </div>
            {isOpen && agency.children && (
                <div className="ml-4">
                    {agency.children.map(child => (
                        <AgencyItem key={child.id} agency={child} onAgencySelect={onAgencySelect} />
                    ))}
                </div>
            )}
        </div>
    );
};

const CollapsibleFilter: React.FC<CollapsibleFilterProps> = ({ agencies, onAgencySelect }) => {
    return (
        <div>
            <a href="#" onClick={() => onAgencySelect(null)} className="text-primary hover:underline">All Agencies</a>
            {agencies.map(agency => (
                <AgencyItem key={agency.id} agency={agency} onAgencySelect={onAgencySelect} />
            ))}
        </div>
    );
};

export default CollapsibleFilter;
