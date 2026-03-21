// Shared calendar data fetching and processing logic
class CalendarDataService {
    static async getAuthToken() {
        const tokenResponse = await chrome.identity.getAuthToken({ 
            interactive: true,
            scopes: ['https://www.googleapis.com/auth/calendar.readonly']
        });

        if (!tokenResponse || !tokenResponse.token) {
            throw new Error('No auth token available');
        }

        return tokenResponse.token;
    }

    static async fetchCalendarEvents(startDate, endDate) {
        const token = await this.getAuthToken();

        // Get list of calendars
        const calendarsResponse = await fetch(
            'https://www.googleapis.com/calendar/v3/users/me/calendarList',
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            }
        );

        if (!calendarsResponse.ok) {
            throw new Error('Failed to fetch calendar list');
        }

        const calendarsData = await calendarsResponse.json();

        // Fetch events from each calendar
        const allEvents = [];
        for (const calendar of calendarsData.items) {
            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?` +
                `timeMin=${startDate.toISOString()}&` +
                `timeMax=${endDate.toISOString()}&` +
                `singleEvents=true&` +
                `orderBy=startTime`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                data.items.forEach(event => {
                    event.calendarId = calendar.id;
                    event.calendarName = calendar.summary;
                });
                allEvents.push(...data.items);
            } else {
                console.warn(`Failed to fetch events for calendar ${calendar.summary}`);
            }
        }

        return allEvents;
    }

    static processCalendarData(events, startDate = null, endDate = null) {
        const calendarData = {};

        // Filter out all-day events
        const timedEvents = events.filter(event => {
            if (!event.start || !event.end) {
                return false;
            }
            // Check if it's an all-day event (has date but no dateTime)
            return event.start.dateTime !== undefined;
        });

        console.log(`ProcessCalendarData: Processing ${timedEvents.length} timed events of ${events.length} total`);

        // Calculate total hours for each calendar, clipping to date range if provided
        timedEvents.forEach(event => {
            let start = new Date(event.start.dateTime);
            let end = new Date(event.end.dateTime);
            const calendarId = event.calendarName || event.calendarId || 'Unknown';
            
            // Clip event to the specified date range if provided
            if (startDate && endDate) {
                // If event is completely outside the range, skip it
                if (end <= startDate || start >= endDate) {
                    return;
                }
                
                // Clip start and end to the range boundaries
                if (start < startDate) {
                    start = new Date(startDate);
                }
                if (end > endDate) {
                    end = new Date(endDate);
                }
            }
            
            if (!calendarData[calendarId]) {
                calendarData[calendarId] = {
                    totalHours: 0,
                    events: []
                };
            }

            const duration = (end - start) / (1000 * 60 * 60); // Convert to hours
            calendarData[calendarId].totalHours += duration;
            calendarData[calendarId].events.push({
                ...event,
                duration: duration,
                clippedStart: start,
                clippedEnd: end
            });
        });

        console.log('ProcessCalendarData results:', Object.entries(calendarData).map(([id, data]) => 
            `${id}: ${data.totalHours.toFixed(1)}h`
        ).join(', '));

        return calendarData;
    }

    static calculateWeeklyBreakdown(events, startDate, endDate, weeksBack) {
        const calendarData = {};

        // Filter out all-day events
        const timedEvents = events.filter(event => {
            return event.start && event.end && event.start.dateTime !== undefined;
        });

        console.log(`Processing ${timedEvents.length} timed events for weekly breakdown`);
        console.log('Start date for weekly breakdown:', startDate.toLocaleDateString(), 'End:', endDate.toLocaleDateString());

        let sleepEventsInWeek3 = [];

        // Group events by week and category, splitting events that span multiple weeks
        timedEvents.forEach(event => {
            const start = new Date(event.start.dateTime);
            const end = new Date(event.end.dateTime);
            const calendarId = event.calendarName || event.calendarId || 'Unknown';
            
            // Calculate which weeks this event spans (using full timestamps, not normalized dates)
            const startDaysSince = (start - startDate) / (1000 * 60 * 60 * 24);
            const endDaysSince = (end - startDate) / (1000 * 60 * 60 * 24);
            
            const startWeekIndex = Math.floor(startDaysSince / 7);
            const endWeekIndex = Math.floor(endDaysSince / 7);
            
            // Skip if completely outside range
            if (endWeekIndex < 0 || startWeekIndex >= weeksBack) {
                return;
            }
            
            // Initialize structures
            if (!calendarData[calendarId]) {
                calendarData[calendarId] = {
                    weeklyHours: new Array(weeksBack).fill(0),
                    totalHours: 0,
                    eventCount: 0
                };
            }
            
            // If event spans multiple weeks, split it
            if (startWeekIndex !== endWeekIndex) {
                // Split across weeks
                for (let weekIdx = Math.max(0, startWeekIndex); weekIdx <= Math.min(weeksBack - 1, endWeekIndex); weekIdx++) {
                    // Calculate week boundaries
                    const weekStartTime = startDate.getTime() + (weekIdx * 7 * 24 * 60 * 60 * 1000);
                    const weekEndTime = startDate.getTime() + ((weekIdx + 1) * 7 * 24 * 60 * 60 * 1000);
                    
                    // Get the portion of the event that falls within this week
                    const effectiveStart = Math.max(start.getTime(), weekStartTime);
                    const effectiveEnd = Math.min(end.getTime(), weekEndTime);
                    
                    const duration = (effectiveEnd - effectiveStart) / (1000 * 60 * 60);
                    
                    if (duration > 0) {
                        calendarData[calendarId].weeklyHours[weekIdx] += duration;
                        calendarData[calendarId].totalHours += duration;
                        
                        // Track Sleep events in week 3 for debugging
                        if (calendarId === 'Sleep' && weekIdx === 3) {
                            sleepEventsInWeek3.push({
                                start: new Date(effectiveStart).toLocaleString(),
                                end: new Date(effectiveEnd).toLocaleString(),
                                duration: duration.toFixed(2),
                                originalStart: start.toLocaleString(),
                                originalEnd: end.toLocaleString(),
                                weekIndex: weekIdx,
                                split: 'yes'
                            });
                        }
                    }
                }
                calendarData[calendarId].eventCount += 1;
            } else {
                // Event is within a single week
                const weekIndex = startWeekIndex;
                
                if (weekIndex >= 0 && weekIndex < weeksBack) {
                    const duration = (end - start) / (1000 * 60 * 60);
                    calendarData[calendarId].weeklyHours[weekIndex] += duration;
                    calendarData[calendarId].totalHours += duration;
                    calendarData[calendarId].eventCount += 1;
                    
                    // Track Sleep events in week 3 for debugging
                    if (calendarId === 'Sleep' && weekIndex === 3) {
                        sleepEventsInWeek3.push({
                            start: start.toLocaleString(),
                            end: end.toLocaleString(),
                            duration: duration.toFixed(2),
                            weekIndex,
                            split: 'no'
                        });
                    }
                }
            }
        });

        console.log('Weekly breakdown by calendar:', calendarData);
        
        // Log the specific week that includes March 9-15
        Object.entries(calendarData).forEach(([calId, data]) => {
            if (data.totalHours > 0) {
                console.log(`${calId}: Weekly hours = [${data.weeklyHours.map(h => h.toFixed(1)).join(', ')}]`);
            }
        });
        
        // Log Sleep events in week 3
        if (sleepEventsInWeek3.length > 0) {
            console.log(`Sleep events in week 3 (Mar 9-15): ${sleepEventsInWeek3.length} events`);
            console.log('Sleep week 3 details:', sleepEventsInWeek3);
            const totalWeek3Sleep = sleepEventsInWeek3.reduce((sum, e) => sum + parseFloat(e.duration), 0);
            console.log(`Total Sleep hours in week 3: ${totalWeek3Sleep.toFixed(2)}h`);
        }
        
        return calendarData;
    }
}
