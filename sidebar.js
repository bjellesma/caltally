class CategoryAverages {
    constructor() {
        this.averagesData = null;
        this.weeksBack = null;
        this.startDate = null;
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('calculateAverages').addEventListener('click', () => {
            this.calculateAverages();
        });
    }

    async calculateAverages() {
        const weeksBack = parseInt(document.getElementById('weeksBack').value);
        
        if (!weeksBack || weeksBack < 1) {
            alert('Please enter a valid number of weeks');
            return;
        }

        try {
            const container = document.getElementById('averagesContainer');
            container.innerHTML = '<div class="loading-text">Calculating averages...</div>';

            // Calculate date range for complete weeks (Monday to Sunday)
            // Exclude the current week - only look at completed weeks
            const today = new Date();
            const currentDayOfWeek = today.getDay();
            
            // Calculate days until we reach the last completed Sunday
            // If today is Sunday (0), go back 7 days to previous Sunday
            // If today is Monday-Saturday (1-6), go back to last Sunday
            const daysToLastCompletedSunday = currentDayOfWeek === 0 ? 7 : currentDayOfWeek;
            
            // End date is the last completed Sunday at end of day (local time)
            const endDate = new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate() - daysToLastCompletedSunday,
                23, 59, 59, 999
            );
            
            // Calculate the Monday of the first week we want to include
            const daysToSubtract = (weeksBack * 7) - 1;
            
            // Start date is weeksBack weeks before, at Monday start of day (local time)
            const startDate = new Date(
                endDate.getFullYear(),
                endDate.getMonth(),
                endDate.getDate() - daysToSubtract,
                0, 0, 0, 0
            );

            // Use shared service to fetch events
            const allEvents = await CalendarDataService.fetchCalendarEvents(startDate, endDate);

            console.log('Sidebar date range:', {
                start: startDate.toISOString(),
                end: endDate.toISOString(),
                startLocal: startDate.toLocaleString(),
                endLocal: endDate.toLocaleString(),
                weeksBack: weeksBack
            });
            console.log('Sidebar fetched events:', allEvents.length);

            this.weeksBack = weeksBack;
            this.startDate = startDate;
            this.processAverages(allEvents, weeksBack, startDate, endDate);
        } catch (error) {
            console.error('Error calculating averages:', error);
            const container = document.getElementById('averagesContainer');
            container.innerHTML = '<p class="error-message">Failed to calculate averages. Please try again.</p>';
        }
    }

    processAverages(events, weeksBack, startDate, endDate) {
        // Use shared service to calculate weekly breakdown
        const calendarData = CalendarDataService.calculateWeeklyBreakdown(events, startDate, endDate, weeksBack);

        // Calculate averages
        const averages = Object.entries(calendarData).map(([calendarId, data]) => {
            // Calculate average by summing all weeks and dividing by number of weeks
            const avgPerWeek = data.totalHours / weeksBack;
            
            return {
                calendarId,
                totalHours: data.totalHours,
                eventCount: data.eventCount,
                avgPerWeek: avgPerWeek,
                weeksWithActivity: data.weeklyHours.filter(h => h > 0).length,
                weeklyHours: data.weeklyHours // Store the weekly breakdown
            };
        });

        // Sort by average per week (descending)
        averages.sort((a, b) => b.avgPerWeek - a.avgPerWeek);

        this.averagesData = averages;
        this.displayAverages(averages, weeksBack);
    }

    displayAverages(averages, weeksBack) {
        const container = document.getElementById('averagesContainer');
        
        if (averages.length === 0) {
            container.innerHTML = '<p class="empty-message">No events found in the selected period</p>';
            return;
        }

        let html = `<div class="averages-header">Past ${weeksBack} week${weeksBack > 1 ? 's' : ''} (Mon-Sun)</div>`;
        
        averages.forEach((avg, index) => {
            html += `
                <div class="average-item">
                    <div class="average-row">
                        <span class="average-category">${avg.calendarId}</span>
                        <span class="average-value clickable" data-index="${index}" title="Click for breakdown">${avg.avgPerWeek.toFixed(1)}h</span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Add click listeners to average values
        container.querySelectorAll('.average-value.clickable').forEach(elem => {
            elem.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.showBreakdown(averages[index]);
            });
        });
    }

    showBreakdown(avgData) {
        console.log('Showing breakdown for:', avgData.calendarId);
        console.log('Weekly hours:', avgData.weeklyHours);
        console.log('Start date for weeks:', this.startDate.toLocaleDateString());
        
        // Create modal backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.addEventListener('click', () => backdrop.remove());

        // Create modal
        const modal = document.createElement('div');
        modal.className = 'breakdown-modal';
        modal.addEventListener('click', (e) => e.stopPropagation());

        // Build modal content
        let html = `
            <div class="modal-header">
                <h3>${avgData.calendarId}</h3>
                <button class="modal-close" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="breakdown-summary">
                    <strong>Average:</strong> ${avgData.avgPerWeek.toFixed(1)}h per week
                </div>
                <div class="breakdown-weeks">
        `;

        // Generate week labels and display hours
        avgData.weeklyHours.forEach((hours, index) => {
            const weekStartDate = new Date(this.startDate);
            weekStartDate.setDate(this.startDate.getDate() + (index * 7));
            
            const weekEndDate = new Date(weekStartDate);
            weekEndDate.setDate(weekStartDate.getDate() + 6);
            
            const weekLabel = `${weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
            
            html += `
                <div class="breakdown-week">
                    <span class="week-label">${weekLabel}</span>
                    <span class="week-value">${hours.toFixed(1)}h</span>
                </div>
            `;
        });

        html += `
                </div>
                <div class="breakdown-total">
                    <strong>Total:</strong> ${avgData.totalHours.toFixed(1)}h over ${this.weeksBack} weeks
                </div>
            </div>
        `;

        modal.innerHTML = html;
        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);
    }
}

// Initialize the sidebar when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CategoryAverages();
});
