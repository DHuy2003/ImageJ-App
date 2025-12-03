import { useEffect } from 'react';
import type { FilterType } from '../dialogs/filters/FiltersDialog';

// Event name constant
export const FILTER_DIALOG_EVENT = 'open-filter-dialog';

// Custom event interface
export interface FilterDialogEventDetail {
    filterType: FilterType;
}

interface UseFilterEventsProps {
    onOpenFilterDialog: (filterType: FilterType) => void;
}

/**
 * Hook to handle filter menu events from NavBar.
 * Listens for 'open-filter-dialog' events and triggers the appropriate dialog.
 */
const useFilterEvents = ({ onOpenFilterDialog }: UseFilterEventsProps) => {
    useEffect(() => {
        const handleFilterDialogEvent = (e: Event) => {
            const customEvent = e as CustomEvent<FilterDialogEventDetail>;
            onOpenFilterDialog(customEvent.detail.filterType);
        };

        window.addEventListener(FILTER_DIALOG_EVENT, handleFilterDialogEvent);

        return () => {
            window.removeEventListener(FILTER_DIALOG_EVENT, handleFilterDialogEvent);
        };
    }, [onOpenFilterDialog]);
};

/**
 * Dispatch a filter dialog event to open a specific filter dialog.
 */
export const dispatchFilterDialogEvent = (filterType: FilterType) => {
    window.dispatchEvent(
        new CustomEvent<FilterDialogEventDetail>(FILTER_DIALOG_EVENT, {
            detail: { filterType },
        })
    );
};

export default useFilterEvents;

