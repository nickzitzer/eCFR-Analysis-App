"use client";

import React, { useMemo, useState } from 'react';
import { Agency } from '@/app/data';

interface AgencyDropdownProps {
    agencies: Agency[];
    onAgencySelect: (agencyId: number | null) => void;
}

const AgencyDropdown: React.FC<AgencyDropdownProps> = ({ agencies, onAgencySelect }) => {
    const [selectedIds, setSelectedIds] = useState<(number | null)[]>([]);

    const handleSelect = (level: number, agencyIdStr: string) => {
        const agencyId = agencyIdStr ? parseInt(agencyIdStr, 10) : null;
        
        // Truncate the selection path to the current level
        const newSelectedIds = selectedIds.slice(0, level);
        
        if (agencyId !== null) {
            newSelectedIds.push(agencyId);
        }

        setSelectedIds(newSelectedIds);

        // Determine the final selected agency to notify the parent
        const finalSelectedId = newSelectedIds.length > 0 ? newSelectedIds[newSelectedIds.length - 1] : null;
        onAgencySelect(finalSelectedId);
    };
    
    // --- Generate Dropdowns Dynamically ---
    const dropdowns = [];
    let currentLevelAgencies = agencies;
    for (let level = 0; ; level++) {
        const selectedId = selectedIds[level] || null;

        // Common class for dropdowns for a consistent look
        const selectClassName = "w-full p-2.5 border border-slate-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition";

        dropdowns.push(
            <div key={level}>
                <label htmlFor={`agency-select-${level}`} className="block text-sm font-medium text-slate-700 mb-1">
                    {`Agency`}
                    <small className="pl-1 text-gray-500">{`(Level ${level + 1})`}</small>
                </label>
                <select
                    suppressHydrationWarning
                    id={`agency-select-${level}`}
                    onChange={(e) => handleSelect(level, e.target.value)}
                    value={selectedId || ''}
                    className={selectClassName}
                >
                    <option value="">{'Select an agency...'}</option>
                    {currentLevelAgencies.map(agency => (
                        <option key={agency.id} value={agency.id}>{agency.name}</option>
                    ))}
                </select>
            </div>
        );

        // Find the next level of agencies to display
        const selectedAgency = selectedId ? currentLevelAgencies.find(a => a.id === selectedId) : null;
        if (selectedAgency && selectedAgency.children && selectedAgency.children.length > 0) {
            currentLevelAgencies = selectedAgency.children;
        } else {
            // Stop if there are no more children
            break;
        }
    }
    
    // --- Display Current Selection Path ---
    const selectionPath = useMemo(() => {
        const path: string[] = [];
        let currentLevelAgencies = agencies;
        for (const id of selectedIds) {
            const agency = currentLevelAgencies.find(a => a.id === id);
            if (agency) {
                path.push(agency.name);
                currentLevelAgencies = agency.children || [];
            } else {
                break;
            }
        }
        return path;
    }, [selectedIds, agencies]);


    return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dropdowns}
            </div>
    );
};

export default AgencyDropdown;
