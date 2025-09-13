import React, { useState, useEffect } from 'react';
import NavBar from "../components/NavBar";
import { authAPI, pushupAPI } from '../utils/api';
import { clearTokenCache } from '../utils/api';
import { auth } from '../lib/firebase';
import { useFirebaseAuth } from '../hooks/useFirebaseAuth';


// Sparkline component with empty state handling
const Sparkline = ({ data, color = "#3b82f6", width = 100, height = 30 }) => {
  // No data at all - show placeholder
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-300 text-xs w-full" style={{ height: '30px', marginTop: '0.5rem' }}>
        No data yet
      </div>
    );
  }

  // Filter out meaningful data points (non-zero or has variation)
  const meaningfulData = data.filter((value, index, arr) => {
    // Keep if value is non-zero OR if there's variation in the dataset
    return value > 0 || arr.some(v => v !== value);
  });

  // Not enough meaningful data points - show different placeholder
  if (meaningfulData.length < 2) {
    return (
      <div className="flex items-center justify-center opacity-50 w-full" style={{ height: '30px', marginTop: '0.5rem' }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="h-5 w-15">
          {/* Show dots for individual data points */}
          {data.slice(-3).map((value, index) => (
            <circle
              key={index}
              cx={20 + (index * 20)}
              cy={height / 2}
              r="2"
              fill={color}
              opacity="0.4"
            />
          ))}
        </svg>
      </div>
    );
  }

  // Enough data - render normal sparkline
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - (((value - min) / range) * (height * 0.8)) - (height * 0.1);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="flex items-center justify-center w-full" style={{ height: '30px', marginTop: '0.5rem' }}>
      <svg className="opacity-70" viewBox={`0 0 ${width} ${height}`} style={{ height: '30px' }}>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};

// Stat Card component
const StatCard = ({ title, value, data, color }) => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 text-center transition-all duration-200 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10">
      <div className="text-4xl font-extrabold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-500 font-medium">{title}</div>
      <Sparkline data={data} color={color} />
    </div>
  );
};

// Progress Bar component
const ProgressBar = ({ current, goal, onEditGoal }) => {
  const percentage = Math.min((current / goal) * 100, 100);
  const remaining = Math.max(goal - current, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="text-lg font-semibold text-gray-900">Push-up Goal Progress</div>
        <button
          className="text-gray-500 hover:bg-gray-100 hover:text-blue-500 p-1 rounded transition-colors duration-200"
          onClick={onEditGoal}
          title="Edit goal"
        >
          ✏️
        </button>
      </div>
      <div className="bg-gray-100 h-3 rounded-md overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-md transition-all duration-500"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="flex justify-between text-sm text-gray-500 mb-2">
        <span>{current} / {goal} reps</span>
        <span>{Math.round(percentage)}%</span>
      </div>
      {remaining > 0 && (
        <div className="text-sm text-green-600 font-medium">
          {remaining} reps to hit today's goal! 💪
        </div>
      )}
      {remaining === 0 && (
        <div className="text-sm text-green-600 font-medium">
          🎉 Goal achieved! Great work!
        </div>
      )}
    </div>
  );
};

// Chart component
const WeeklyChart = ({ data, labels }) => {
  const max = Math.max(...data) || 1;

  return (
    <div>
      <h3 className="mb-4 text-gray-900 font-semibold">Past 7-Day Activity</h3>
      <div className="flex items-end gap-2 px-4 mb-2" style={{ height: '120px' }}>
        {data.map((value, index) => (
          <div
            key={index}
            className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t hover:from-blue-700 hover:to-blue-500 transition-all duration-200 cursor-pointer min-h-1"
            style={{ height: `${(value / max) * 100}%` }}
            title={`${labels[index]}: ${value} reps`}
          ></div>
        ))}
      </div>
      <div className="flex gap-2 px-4 mt-2">
        {labels.map((day, index) => (
          <div key={index} className="flex-1 text-center text-xs text-gray-500">{day}</div>
        ))}
      </div>
    </div>
  );
};

function Dashboard() {
  const { user, isVerified } = useFirebaseAuth(); // Add Firebase auth hook
  const [userName, setUserName] = useState('User'); // State for real user name
  const [isLoading, setIsLoading] = useState(true); // Loading state for dashboard
  const [todayReps, setTodayReps] = useState(0); // State for real today's reps
  const [todayRepsData, setTodayRepsData] = useState([]); // State for sparkline data
  const [allTimeReps, setAllTimeReps] = useState(0); // State for real all-time reps
  const [allTimeRepsData, setAllTimeRepsData] = useState([]); // State for all-time sparkline
  const [bestDay, setBestDay] = useState(0); // State for real best day reps
  const [bestDayData, setBestDayData] = useState([]); // State for best day sparkline
  const [appearanceStreak, setAppearanceStreak] = useState(0); // State for real appearance streak
  const [appearanceStreakData, setAppearanceStreakData] = useState([]); // State for streak sparkline
  const [appearanceStreakColor, setAppearanceStreakColor] = useState('red'); // State for appearance streak message color
  const [avgPerSession, setAvgPerSession] = useState(0); // State for real average per session
  const [avgPerSessionData, setAvgPerSessionData] = useState([]); // State for avg/session sparkline
  const [recentSessions, setRecentSessions] = useState([]); // State for real recent sessions
  const [allSessions, setAllSessions] = useState([]); // State for all sessions data
  const [dailyGoal, setDailyGoal] = useState(null); // State for real daily goal - null until loaded from DB
  const [weeklyChartData, setWeeklyChartData] = useState([]); // State for real 7-day activity data
  const [weeklyChartLabels, setWeeklyChartLabels] = useState([]); // State for dynamic day labels
  const [last7DaysReps, setLast7DaysReps] = useState(0); // State for total reps in last 7 days
  const [avgRepsPerDay, setAvgRepsPerDay] = useState(0); // State for average reps per day in last 7 days
  const [sessionsLast7Days, setSessionsLast7Days] = useState(0); // State for sessions in last 7 days
  const [goalStreak, setGoalStreak] = useState(0); // State for real goal streak
  const [goalStreakData, setGoalStreakData] = useState(''); // State for goal streak message
  const [goalStreakColor, setGoalStreakColor] = useState('green'); // State for goal streak message color
  const [currentDate, setCurrentDate] = useState('');

  // Helper function to get color classes based on streak color
  const getStreakColorClasses = (color) => {
    switch (color) {
      case 'green':
        return 'text-green-500 bg-green-50';
      case 'orange':
        return 'text-orange-500 bg-orange-50';
      case 'red':
        return 'text-red-500 bg-red-50';
      default:
        return 'text-gray-500 bg-gray-50';
    }
  };

  // Helper function to get local date string (YYYY-MM-DD) without timezone issues
  const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Function to calculate goal streak
  const calculateGoalStreak = (sessions, goalValue) => {
    if (!sessions || sessions.length === 0 || !goalValue) {
      setGoalStreak(0);
      setGoalStreakData('Start your goal streak!');
      setGoalStreakColor('red');
      return;
    }

    // Group sessions by date to get daily totals
    const dailyTotalsForGoal = {};
    sessions.forEach(session => {
      const sessionDate = getLocalDateString(new Date(session.startedAt));
      if (!dailyTotalsForGoal[sessionDate]) {
        dailyTotalsForGoal[sessionDate] = 0;
      }
      dailyTotalsForGoal[sessionDate] += session.count;
    });

    // Get today's date and check if user met goal today
    const todayGoalDate = new Date();
    const todayGoalDateString = getLocalDateString(todayGoalDate);
    const todayGoalReps = dailyTotalsForGoal[todayGoalDateString] || 0;
    const metGoalToday = todayGoalReps >= goalValue;


    // Calculate goal streak by going backwards from today (or yesterday if goal not met today)
    let currentGoalStreak = 0;
    let startGoalDay = metGoalToday ? 0 : 1; // Start from yesterday if goal not met today

    // Check each day going backwards
    for (let i = startGoalDay; i < 365; i++) { // Max check 365 days back
      const checkGoalDate = new Date(todayGoalDate);
      checkGoalDate.setDate(checkGoalDate.getDate() - i);
      const dateGoalString = getLocalDateString(checkGoalDate);

      const dayReps = dailyTotalsForGoal[dateGoalString] || 0;
      const metGoalThisDay = dayReps >= goalValue;

      if (metGoalThisDay) {
        currentGoalStreak++;
      } else {
        break; // Break streak if goal not met
      }
    }

    setGoalStreak(currentGoalStreak);

    // Create goal streak message and color
    let goalStreakMessage = '';
    let goalStreakColor = '';
    if (metGoalToday) {
      goalStreakMessage = 'Goal achieved today!';
      goalStreakColor = 'green'; // Green for achieved goal
    } else if (currentGoalStreak > 0) {
      const remaining = goalValue - todayGoalReps;
      goalStreakMessage = `${remaining} more to keep streak!`;
      goalStreakColor = 'orange'; // Orange for need to keep streak
    } else {
      goalStreakMessage = 'Start your goal streak!';
      goalStreakColor = 'red'; // Red for no streak
    }
    setGoalStreakData(goalStreakMessage);
    setGoalStreakColor(goalStreakColor);

  };

  // Fetch user name with retry logic for mobile Safari
  const fetchUserNameWithRetry = async (maxRetries = 1) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const success = await fetchUserName(attempt);
        if (success) {
          return;
        }
      } catch (error) {
        console.error(`❌ Attempt ${attempt + 1} failed:`, error);
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }
    setUserName('User');
  };

  // Fetch the user name and daily goal from API
  const fetchUserName = async (retryCount = 0) => {
    try {
      const userResponse = await authAPI.getProfile();

      // The correct response structure is: Axios wraps it as { data: { success: true, user: { name, email, ... } } }
      let name = null;
      if (userResponse?.data?.user?.name) {
        name = userResponse.data.user.name;
      }

      if (name) {
        setUserName(name);
        return true;
      } else {

        // Try to create the profile if it doesn't exist with retry logic
        const isMobile = /iPhone|iPad|iPod|Android/.test(navigator.userAgent);
        const maxRetries = isMobile ? 5 : 3; // More retries for mobile

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {

            if (isMobile && attempt > 0) {
              // Longer delays for mobile, especially for timeout recovery
              const delay = attempt === 1 ? 3000 : 2000; // 3s for first retry, 2s for others
              await new Promise(resolve => setTimeout(resolve, delay));
            }

            const createResponse = await authAPI.createProfile({
              name: auth.currentUser.email.split('@')[0], // Use email prefix as default name
              email: auth.currentUser.email
            });

            if (createResponse?.data?.user?.name) {
              setUserName(createResponse.data.user.name);
              return true;
            }
          } catch (createError) {
            // Log error for monitoring
            console.error('Profile creation error:', createError.message);
          }
        }

        setUserName('User');
        return false; // Return false to indicate failure
      }

      // Get daily goal from user profile
      if (userResponse?.data?.user?.dailyGoal) {
        setDailyGoal(userResponse.data.user.dailyGoal);
      } else {
        // If user doesn't have a daily goal set, use default
        setDailyGoal(50);
      }

      return true; // Return true to indicate success
    } catch (err) {
      // Log error for monitoring
      console.error('Error fetching user profile:', err.message);

      // If it's a 403 error and we haven't retried too many times, try again
      if (err.response?.status === 403 && retryCount < 2) {
        // Force refresh token and clear cache
        if (auth?.currentUser) {
          try {
            await auth.currentUser.getIdToken(true);
            clearTokenCache();
            await new Promise(resolve => setTimeout(resolve, 2000));
            return fetchUserName(retryCount + 1);
          } catch (tokenError) {
            console.error('Error refreshing token:', tokenError.message);
          }
        }
      }

      // Backend should now auto-create profiles, so this should rarely happen
      // Keep defaults if API call fails
      setUserName('User');
      setDailyGoal(50);
      return false; // Return false to indicate failure
    }
  };

  useEffect(() => {
    // Force refresh Firebase auth state if user just verified email
    const initializeDashboard = async () => {
      console.log('🚀 Initializing dashboard...');

      // Check if we're coming from email verification (force refresh auth state)
      if (auth?.currentUser) {
        try {
          await auth.currentUser.reload();

          // Force get a fresh ID token to ensure backend gets updated verification status
          if (auth.currentUser.emailVerified) {
            await auth.currentUser.getIdToken(true);
            // Clear token cache to ensure fresh tokens are used
            clearTokenCache();
            console.log('✅ Fresh token obtained and cache cleared');
          }
        } catch (error) {
          console.error('❌ Error refreshing auth state:', error);
        }
      } else {
      }

      // Set current date
      const today = new Date();
      const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      };
      setCurrentDate(today.toLocaleDateString('en-US', options));

      // For mobile Safari, add extra delay and retry logic
      const isMobileSafari = /iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent);
      if (isMobileSafari && auth?.currentUser?.emailVerified) {
        console.log('📱 Mobile Safari detected - adding extra delay for token propagation...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Longer delay for mobile
      } else if (auth?.currentUser?.emailVerified) {
        console.log('⏳ Waiting for token propagation after verification...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Fetch the user name and daily goal from API with retry logic for mobile
      await fetchUserNameWithRetry(isMobileSafari ? 3 : 1);

      // Fetch today's reps and other data (this function handles all calculations)
      await fetchTodayReps();

      // Set loading to false after all data is loaded
      setIsLoading(false);
    };

    // Fetch today's reps from user sessions
    const fetchTodayReps = async () => {
      try {
        console.log('🔄 Starting fetchTodayReps...');
        // Get user profile first to get the daily goal
        const userResponse = await authAPI.getProfile();
        const userDailyGoal = userResponse?.data?.user?.dailyGoal || 20;

        // Ensure daily goal is set in state
        setDailyGoal(userDailyGoal);

        const sessionsResponse = await pushupAPI.list();
        console.log('📊 Raw API response:', sessionsResponse);

        // The correct path is sessionsResponse.data.data.sessions
        const sessions = sessionsResponse.data.data.sessions || [];

        console.log('All sessions from API:', sessions);

        // Store all sessions in state for goal streak recalculation
        setAllSessions(sessions);
        console.log('💾 Stored sessions in state:', sessions.length, 'sessions');

        // Calculate ALL-TIME total reps
        const totalAllTimeReps = sessions.reduce((sum, session) => sum + session.count, 0);
        setAllTimeReps(totalAllTimeReps);

        // Calculate all-time sparkline data (last 30 days for better trend)
        const last30Days = [];
        let cumulativeTotal = 0;

        // Sort sessions by date to build cumulative total over time
        const sortedSessions = [...sessions].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

        for (let i = 29; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateString = getLocalDateString(date);

          // Find sessions up to this date for cumulative total
          const sessionsUpToDate = sortedSessions.filter(session => {
            const sessionDate = getLocalDateString(new Date(session.startedAt));
            return sessionDate <= dateString;
          });

          cumulativeTotal = sessionsUpToDate.reduce((sum, session) => sum + session.count, 0);
          last30Days.push(cumulativeTotal);
        }

        setAllTimeRepsData(last30Days);

        // Calculate BEST DAY (highest daily total, not single session)
        // Group sessions by date and find the date with highest total
        const dailyTotals = {};

        sessions.forEach(session => {
          const sessionDate = getLocalDateString(new Date(session.startedAt));
          if (!dailyTotals[sessionDate]) {
            dailyTotals[sessionDate] = 0;
          }
          dailyTotals[sessionDate] += session.count;
        });

        // Find the day with the highest total
        const bestDayTotal = Math.max(...Object.values(dailyTotals), 0);
        const bestDayDate = Object.keys(dailyTotals).find(date => dailyTotals[date] === bestDayTotal);

        setBestDay(bestDayTotal);

        // Calculate best day sparkline data (show daily totals progression)
        const dailyTotalsArray = [];

        // Sort dates and show progression of daily totals
        const sortedDates = Object.keys(dailyTotals).sort();
        sortedDates.forEach(date => {
          dailyTotalsArray.push(dailyTotals[date]);
        });

        // Take last 10 daily totals for sparkline (or pad with zeros if less than 10 days)
        const last10DailyTotals = dailyTotalsArray.length >= 10
          ? dailyTotalsArray.slice(-10)
          : [...Array(10 - dailyTotalsArray.length).fill(0), ...dailyTotalsArray];

        setBestDayData(last10DailyTotals);

        // Calculate APPEARANCE STREAK (consecutive days with at least 1 session)
        // Create array of dates with sessions
        const datesWithSessions = new Set(
          sessions.map(session => getLocalDateString(new Date(session.startedAt)))
        );

        // Get today's date in YYYY-MM-DD format
        const todayDate = new Date();
        const todayDateString = getLocalDateString(todayDate);
        const hasSessionToday = datesWithSessions.has(todayDateString);

        // Calculate current streak
        let currentStreak = 0;
        let startDay = hasSessionToday ? 0 : 1; // Start from yesterday if no session today

        // Check each day going backwards from today (or yesterday if no session today)
        for (let i = startDay; i < 365; i++) { // Max check 365 days back
          const checkDate = new Date(todayDate);
          checkDate.setDate(checkDate.getDate() - i);
          const dateString = getLocalDateString(checkDate);

          if (datesWithSessions.has(dateString)) {
            currentStreak++;
          } else {
            // Break streak if we find a day without sessions
            break;
          }
        }

        setAppearanceStreak(currentStreak);

        // Create streak message and color
        let streakMessage = '';
        let streakColor = '';
        if (hasSessionToday) {
          streakMessage = 'Great work!';
          streakColor = 'green'; // Green for completed session today
        } else if (currentStreak > 0) {
          streakMessage = 'Log session to keep streak';
          streakColor = 'orange'; // Orange for active streak but no session today
        } else {
          streakMessage = 'Log session to start streak';
          streakColor = 'red'; // Red for no streak
        }
        setAppearanceStreakData(streakMessage); // Store message instead of sparkline data
        setAppearanceStreakColor(streakColor);

        console.log('Dates with sessions:', Array.from(datesWithSessions));
        console.log('Today date string:', todayDateString);
        console.log('Has session today:', hasSessionToday);
        console.log('Current appearance streak:', currentStreak);
        console.log('Streak message:', streakMessage);

        // Calculate AVERAGE PER SESSION
        const totalSessions = sessions.length;
        const avgPerSessionValue = totalSessions > 0 ? Math.round(totalAllTimeReps / totalSessions) : 0;
        setAvgPerSession(avgPerSessionValue);

        // Calculate last 30 days avg per session progression for sparkline
        const avgPerSessionHistory = [];
        for (let i = 29; i >= 0; i--) {
          const endDate = new Date();
          endDate.setDate(endDate.getDate() - i);

          // Get all sessions up to this date
          const sessionsUpToDate = sessions.filter(session => {
            const sessionDate = new Date(session.startedAt);
            return sessionDate <= endDate;
          });

          if (sessionsUpToDate.length > 0) {
            const totalRepsUpToDate = sessionsUpToDate.reduce((sum, session) => sum + session.count, 0);
            const avgUpToDate = Math.round(totalRepsUpToDate / sessionsUpToDate.length);
            avgPerSessionHistory.push(avgUpToDate);
          } else {
            avgPerSessionHistory.push(0);
          }
        }
        setAvgPerSessionData(avgPerSessionHistory);

        console.log('Total sessions:', totalSessions);
        console.log('Average per session:', avgPerSessionValue);
        console.log('Avg per session history:', avgPerSessionHistory);

        // Calculate RECENT SESSIONS (last 5 sessions, sorted by most recent)
        const recentSortedSessions = [...sessions].sort((a, b) =>
          new Date(b.startedAt) - new Date(a.startedAt)
        );
        const recentSessionsData = recentSortedSessions.slice(0, 5).map(session => {
          const sessionDate = new Date(session.startedAt);
          const now = new Date();

          // Format date - compare dates at day level, not exact times
          let dateString;
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());

          const diffTime = today - sessionDay;
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays === 0) {
            dateString = `Today, ${sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          } else if (diffDays === 1) {
            dateString = `Yesterday, ${sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          } else {
            dateString = `${sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          }

          // Use the durationFormatted virtual field from the backend
          const duration = session.durationFormatted || '0s';

          return {
            id: session._id,
            date: dateString,
            duration: duration,
            reps: session.count
          };
        });

        setRecentSessions(recentSessionsData);
        console.log('Recent sessions:', recentSessionsData);

        // Calculate WEEKLY CHART DATA (last 7 days ending on today)
        const weeklyData = [];
        const weeklyLabels = [];

        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateString = getLocalDateString(date);

          // Get day label (Mon, Tue, etc.)
          const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
          weeklyLabels.push(dayLabel);

          // Filter sessions for this specific day
          const daysSessions = sessions.filter(session => {
            const sessionDate = getLocalDateString(new Date(session.startedAt));
            return sessionDate === dateString;
          });

          // Sum up total reps for this day
          const dayTotal = daysSessions.reduce((sum, session) => sum + session.count, 0);
          weeklyData.push(dayTotal);
        }

        setWeeklyChartData(weeklyData);
        setWeeklyChartLabels(weeklyLabels);
        console.log('Weekly chart data (last 7 days):', weeklyData);
        console.log('Weekly chart labels:', weeklyLabels);

        // Calculate 7-DAY INSIGHTS
        const totalRepsLast7Days = weeklyData.reduce((sum, dayTotal) => sum + dayTotal, 0);
        const avgRepsPerDayLast7Days = Math.round(totalRepsLast7Days / 7);

        // Count sessions in last 7 days
        const last7DaysSessions = sessions.filter(session => {
          const sessionDate = new Date(session.startedAt);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // Include today, so -6 days
          return sessionDate >= sevenDaysAgo;
        });

        setLast7DaysReps(totalRepsLast7Days);
        setAvgRepsPerDay(avgRepsPerDayLast7Days);
        setSessionsLast7Days(last7DaysSessions.length);

        console.log('Last 7 days total reps:', totalRepsLast7Days);
        console.log('Average reps per day (last 7 days):', avgRepsPerDayLast7Days);
        console.log('Sessions in last 7 days:', last7DaysSessions.length);

        // Calculate goal streak using the dedicated function
        calculateGoalStreak(sessions, userDailyGoal);

        // Get today's date in YYYY-MM-DD format for comparison
        const today = new Date();
        const todayForSessionsString = getLocalDateString(today);

        // Filter sessions from today and sum up the count (not reps!)
        const todaysSessions = sessions.filter(session => {
          // Use startedAt field instead of date
          const sessionDate = getLocalDateString(new Date(session.startedAt));
          return sessionDate === todayForSessionsString;
        });

        // Sum up count field (not reps!)
        const totalRepsToday = todaysSessions.reduce((sum, session) => sum + session.count, 0);
        console.log('📅 Today\'s sessions:', todaysSessions);
        console.log('🎯 Total reps today:', totalRepsToday);
        setTodayReps(totalRepsToday);

        // Calculate last 7 days of data for sparkline
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateString = getLocalDateString(date);

          const daysSessions = sessions.filter(session => {
            const sessionDate = getLocalDateString(new Date(session.startedAt));
            return sessionDate === dateString;
          });

          const dayTotal = daysSessions.reduce((sum, session) => sum + session.count, 0);
          last7Days.push(dayTotal);
        }

        setTodayRepsData(last7Days);

        console.log('Today\'s sessions:', todaysSessions);
        console.log('Total reps today:', totalRepsToday);
        console.log('Total all-time reps:', totalAllTimeReps);
        console.log('Daily totals by date:', dailyTotals);
        console.log('Best day total:', bestDayTotal);
        console.log('Best day date:', bestDayDate);
        console.log('Last 7 days data for sparkline:', last7Days);
        console.log('Last 30 days cumulative data:', last30Days);
        console.log('Daily totals progression:', last10DailyTotals);
      } catch (err) {
        console.error('Error fetching today\'s reps:', err);
        setTodayReps(0); // Default to 0 if API call fails
        setTodayRepsData([]); // Empty sparkline data if API call fails
        setAllTimeReps(0);
        setAllTimeRepsData([]);
        setBestDay(0);
        setBestDayData([]);
        setAppearanceStreak(0);
        setAppearanceStreakData([]);
        setAppearanceStreakColor('red');
        setAvgPerSession(0);
        setAvgPerSessionData([]);
        setRecentSessions([]);
        setWeeklyChartData([]);
        setWeeklyChartLabels([]);
        setLast7DaysReps(0);
        setAvgRepsPerDay(0);
        setSessionsLast7Days(0);
        setGoalStreak(0);
        setGoalStreakData('Start your goal streak!');
        setGoalStreakColor('red');
      } finally {
        // Set loading to false even if there's an error
        setIsLoading(false);
      }
    };

    // Initialize dashboard
    initializeDashboard();
  }, []);

  // Watch for verification status changes and refresh user data
  useEffect(() => {
    // Skip if still initializing or user not available
    if (!user) return;

    // If user just got verified, refresh their profile data
    if (isVerified && userName === 'User') {

      // Set loading to true while refreshing
      setIsLoading(true);

      // Add a small delay to ensure backend has processed the verification
      const refreshTimer = setTimeout(async () => {
        try {
          await fetchUserName(0);
          console.log('✅ Profile data refreshed after verification');
        } catch (error) {
          console.error('Error refreshing profile after verification:', error);
        } finally {
          // Set loading to false after refresh attempt
          setIsLoading(false);
        }
      }, 1000); // 1 second delay

      return () => clearTimeout(refreshTimer);
    }
  }, [user, isVerified, userName]);

  // Mobile Safari fallback: periodically retry loading profile if still showing "User"
  useEffect(() => {
    const isMobileSafari = /iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent);

    if (isMobileSafari && user && isVerified && userName === 'User' && !isLoading) {
      console.log('📱 Mobile Safari fallback: retrying profile load...');

      const fallbackTimer = setTimeout(async () => {
        try {
          await fetchUserName(0);
        } catch (error) {
          console.error('❌ Fallback retry failed:', error);
        }
      }, 3000); // 3 second delay

      return () => clearTimeout(fallbackTimer);
    }
  }, [user, isVerified, userName, isLoading]);

  const handleEditGoal = async () => {
    const newGoal = prompt('Enter your new daily goal:', dailyGoal.toString());
    if (newGoal && !isNaN(newGoal) && parseInt(newGoal) > 0) {
      try {
        // Save to backend
        const response = await authAPI.updateDailyGoal(parseInt(newGoal));

        if (response.data.success) {
          // Update local state
          setDailyGoal(parseInt(newGoal));
          // Recalculate goal streak with new goal
          calculateGoalStreak(allSessions, parseInt(newGoal));
          console.log('Daily goal updated successfully');
        }
      } catch (error) {
        console.error('Error updating daily goal:', error);
        alert('Failed to save daily goal. Please try again.');
      }
    }
  };

  const handleStartSession = () => {
    alert('Starting new session - this would navigate to session page!');
  };

  const handleSessionClick = (session) => {
    if (session.notes && session.notes.trim().length > 0) {
      alert(`Notes:\n\n${session.notes}`);
    } else {
      alert('No notes were added for this session.');
    }
  };


  // Loading component
  if (isLoading) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <NavBar />
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="animate-spin rounded-full h-20 w-20 border-b-2 border-blue-600 mx-auto mb-6"></div>
            <div className="text-2xl font-bold text-gray-900 mb-3">Loading your dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <NavBar />

      {/* Header Section */}
      <div className="bg-white text-black py-6 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-8">
          <div className="flex justify-center items-center">
            <div className="text-center">
              <div className="text-xl font-semibold mb-1">
                Hey {userName} 👋
              </div>
              <div className="text-sm text-gray-600">
                {currentDate}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-8 py-8">

        {/* Key Stats */}
        <div className="mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <StatCard
              title="Today's Reps"
              value={todayReps}
              data={todayRepsData} // Real sparkline data showing last 7 days
              color="#3b82f6"
            />
            <StatCard
              title="All-time"
              value={allTimeReps.toLocaleString()}
              data={allTimeRepsData} // Real cumulative sparkline data
              color="#f59e0b"
            />
            <StatCard
              title="Best Day"
              value={bestDay}
              data={bestDayData} // Real personal records progression
              color="#8b5cf6"
            />
            {/* Custom Appearance Streak Card with Message */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center transition-all duration-200 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="text-4xl font-extrabold text-gray-900 mb-1">{appearanceStreak}</div>
              <div className="text-sm text-gray-500 font-medium mb-3">Appearance Streak</div>
              <div className={`text-sm font-medium px-3 py-2 rounded-lg ${getStreakColorClasses(appearanceStreakColor)}`}>
                {appearanceStreakData}
              </div>
            </div>
            {/* Custom Goal Streak Card with Message */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center transition-all duration-200 hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="text-4xl font-extrabold text-gray-900 mb-1">{goalStreak}</div>
              <div className="text-sm text-gray-500 font-medium mb-3">Goal Streak</div>
              <div className={`text-sm font-medium px-3 py-2 rounded-lg ${getStreakColorClasses(goalStreakColor)}`}>
                {goalStreakData}
              </div>
            </div>
            <StatCard
              title="Avg/Session"
              value={avgPerSession} // Real average per session
              data={avgPerSessionData} // Real avg per session progression
              color="#06b6d4"
            />
          </div>
        </div>

        {/* Goal Progress */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Daily Goal</h2>
          {dailyGoal !== null ? (
            <ProgressBar
              current={todayReps} // Use real today's reps from actual sessions
              goal={dailyGoal} // Use real daily goal from user profile
              onEditGoal={handleEditGoal}
            />
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <div className="text-gray-500">Loading goal...</div>
            </div>
          )}
        </div>

        {/* Trends & Insights */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Trends & Insights</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <WeeklyChart data={weeklyChartData} labels={weeklyChartLabels} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {last7DaysReps}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Reps in Last 7 Days
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {avgRepsPerDay}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Avg Reps/Day
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {sessionsLast7Days}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  # Sessions (Past 7 Days)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Session History */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Session History</h2>
          <div className="bg-white border border-gray-200 rounded-xl" style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {allSessions.length === 0 ? (
              <div className="text-center py-12 px-4 text-gray-500">
                <div className="text-5xl mb-4 opacity-50">💪</div>
                <div className="text-lg font-semibold">No sessions yet</div>
              </div>
            ) : (
              allSessions.map((session, index) => (
                <div
                  key={session._id}
                  onClick={() => handleSessionClick({
                    id: session._id,
                    date: (() => {
                      const sessionDate = new Date(session.startedAt);
                      const now = new Date();
                      let dateString;
                      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                      const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
                      const diffTime = today - sessionDay;
                      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                      if (diffDays === 0) {
                        dateString = `Today, ${sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                      } else if (diffDays === 1) {
                        dateString = `Yesterday, ${sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                      } else {
                        dateString = `${sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                      }
                      return dateString;
                    })(),
                    duration: session.durationFormatted || '0s',
                    reps: session.count,
                    notes: session.notes || ''
                  })}
                  className={`px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors duration-200 ${index < allSessions.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-sm mb-1">
                      {(() => {
                        const sessionDate = new Date(session.startedAt);
                        const now = new Date();
                        let dateString;
                        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
                        const diffTime = today - sessionDay;
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays === 0) {
                          dateString = `Today, ${sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                        } else if (diffDays === 1) {
                          dateString = `Yesterday, ${sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                        } else {
                          dateString = `${sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${sessionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                        }
                        return dateString;
                      })()}
                    </div>
                    <div className="text-xs text-gray-500">
                      Duration: {session.durationFormatted || '0s'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold text-blue-500">
                      {session.count}
                    </div>
                    <button
                      onClick={async (event) => {
                        event.stopPropagation();
                        if (!window.confirm('Are you sure you want to delete this session?')) return;
                        try {
                          await pushupAPI.delete(session._id);
                          // Refresh dashboard data
                          const userResponse = await authAPI.getProfile();
                          if (userResponse?.data?.user?.name) setUserName(userResponse.data.user.name);
                          if (userResponse?.data?.user?.dailyGoal) setDailyGoal(userResponse.data.user.dailyGoal);
                          // Re-fetch sessions
                          const sessionsResponse = await pushupAPI.list();
                          const sessions = sessionsResponse.data.data.sessions || [];
                          setAllSessions(sessions);
                          window.location.reload();
                        } catch (error) {
                          alert('Failed to delete session. Please try again.');
                        }
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Delete session"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>


      </div>
    </div>
  );
}

export default Dashboard;