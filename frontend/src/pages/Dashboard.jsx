import React, { useState, useEffect } from 'react';
import NavBar from "../components/NavBar";

// Sample data variations - in real app, this would come from your API/state management
const sampleDataExisting = {
  user: {
    name: "Sean",
    todayReps: 12,
    dailyGoal: 20
  },
  stats: {
    todayReps: { value: 12, data: [8, 10, 5, 15, 18, 22, 12] },
    weeklyReps: { value: 89, data: [65, 72, 80, 85, 89, 95, 89] },
    allTimeReps: { value: 1247, data: [1100, 1150, 1180, 1200, 1220, 1235, 1247] },
    streak: { value: 7, data: [3, 4, 5, 6, 7, 7, 7] },
    bestDay: { value: 45, data: [38, 42, 40, 45, 43, 41, 40] },
    avgPerSession: { value: 18, data: [16, 17, 19, 18, 17, 18, 18] }
  },
  recentSessions: [
    { id: 1, date: "Today, 9:15 AM", duration: "2min 30sec", reps: 12 },
    { id: 2, date: "Yesterday, 7:45 AM", duration: "3min 15sec", reps: 18 },
    { id: 3, date: "Dec 13, 8:20 AM", duration: "4min 10sec", reps: 25 },
    { id: 4, date: "Dec 12, 6:30 PM", duration: "2min 45sec", reps: 15 },
    { id: 5, date: "Dec 11, 9:10 AM", duration: "3min 20sec", reps: 22 }
  ],
  weeklyChart: [18, 12, 24, 9, 21, 27, 15],
  insights: {
    avgRepsPerSession: 18,
    sessionsPerWeek: 5,
    mostActiveDay: "Tuesdays and Saturdays"
  }
};

// New user with minimal data
const sampleDataNewUser = {
  user: {
    name: "Alex",
    todayReps: 0,
    dailyGoal: 10
  },
  stats: {
    todayReps: { value: 0, data: [] },
    weeklyReps: { value: 0, data: [] },
    allTimeReps: { value: 0, data: [] },
    streak: { value: 0, data: [] },
    bestDay: { value: 0, data: [] },
    avgPerSession: { value: 0, data: [] }
  },
  recentSessions: [],
  weeklyChart: [0, 0, 0, 0, 0, 0, 0],
  insights: {
    avgRepsPerSession: 0,
    sessionsPerWeek: 0,
    mostActiveDay: null
  }
};

// User with some data but not enough for full sparklines
const sampleDataLimitedUser = {
  user: {
    name: "Jordan",
    todayReps: 5,
    dailyGoal: 15
  },
  stats: {
    todayReps: { value: 5, data: [0, 0, 0, 0, 0, 3, 5] }, // Only 2 days of data
    weeklyReps: { value: 8, data: [8] }, // Only this week
    allTimeReps: { value: 8, data: [8] },
    streak: { value: 2, data: [0, 1, 2] },
    bestDay: { value: 5, data: [3, 5] },
    avgPerSession: { value: 4, data: [3, 5] }
  },
  recentSessions: [
    { id: 1, date: "Today, 10:30 AM", duration: "1min 45sec", reps: 5 },
    { id: 2, date: "Yesterday, 8:15 AM", duration: "1min 20sec", reps: 3 }
  ],
  weeklyChart: [0, 0, 0, 0, 0, 3, 5],
  insights: {
    avgRepsPerSession: 4,
    sessionsPerWeek: 2,
    mostActiveDay: null
  }
};

// Toggle between different user types for demo
const sampleData = sampleDataExisting; // Change this to test different scenarios

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
              cy={height/2} 
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
const WeeklyChart = ({ data }) => {
  const max = Math.max(...data) || 1;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      <h3 className="mb-4 text-gray-900 font-semibold">7-Day Activity</h3>
      <div className="flex items-end gap-2 px-4 mb-2" style={{ height: '200px' }}>
        {data.map((value, index) => (
          <div
            key={index}
            className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t hover:from-blue-700 hover:to-blue-500 transition-all duration-200 cursor-pointer min-h-5"
            style={{ height: `${(value / max) * 100}%` }}
            title={`${days[index]}: ${value} reps`}
          ></div>
        ))}
      </div>
      <div className="flex gap-2 px-4 mt-2">
        {days.map((day, index) => (
          <div key={index} className="flex-1 text-center text-xs text-gray-500">{day}</div>
        ))}
      </div>
    </div>
  );
};

function Dashboard() {
  const [data, setData] = useState(sampleData);
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    // Set current date
    const today = new Date();
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    setCurrentDate(today.toLocaleDateString('en-US', options));
  }, []);

  const handleEditGoal = () => {
    const newGoal = prompt('Enter your new daily goal:', data.user.dailyGoal.toString());
    if (newGoal && !isNaN(newGoal) && parseInt(newGoal) > 0) {
      setData(prev => ({
        ...prev,
        user: {
          ...prev.user,
          dailyGoal: parseInt(newGoal)
        }
      }));
    }
  };

  const handleStartSession = () => {
    alert('Starting new session - this would navigate to session page!');
  };

  const handleSessionClick = (session) => {
    alert(`Session details for ${session.date} - Feature coming soon!`);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <NavBar />
      
      {/* Header Section */}
      <div className="bg-white text-black py-6 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-8">
          <div className="flex justify-center items-center">
            <div className="text-center">
              <div className="text-xl font-semibold mb-1">
                Hey {data.user.name} 👋
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
              value={data.stats.todayReps.value} 
              data={data.stats.todayReps.data}
              color="#3b82f6"
            />
            <StatCard 
              title="All-time" 
              value={data.stats.allTimeReps.value.toLocaleString()} 
              data={data.stats.allTimeReps.data}
              color="#f59e0b"
            />
            <StatCard 
              title="Best Day" 
              value={data.stats.bestDay.value} 
              data={data.stats.bestDay.data}
              color="#8b5cf6"
            />
            <StatCard 
              title="Appearance Streak" 
              value={data.stats.streak.value} 
              data={data.stats.streak.data}
              color="#ef4444"
            />
            <StatCard 
              title="Goal Streak" 
              value={data.stats.streak.value} 
              data={data.stats.streak.data}
              color="#10b981"
            />
            <StatCard 
              title="Avg/Session" 
              value={data.stats.avgPerSession.value} 
              data={data.stats.avgPerSession.data}
              color="#06b6d4"
            />
          </div>
        </div>

        {/* Goal Progress */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Daily Goal</h2>
          <ProgressBar 
            current={data.user.todayReps} 
            goal={data.user.dailyGoal}
            onEditGoal={handleEditGoal}
          />
        </div>

        {/* Trends & Insights */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Trends & Insights</h2>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <WeeklyChart data={data.weeklyChart} />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {data.stats.weeklyReps.value}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  This Week's Reps
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {data.insights.avgRepsPerSession}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Avg Reps/Session
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {data.insights.sessionsPerWeek}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Sessions/Week
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4 text-sm text-blue-900">
              {data.insights.mostActiveDay ? (
                `💡 You're most active on ${data.insights.mostActiveDay}. Try scheduling sessions on quieter days like Thursday!`
              ) : data.recentSessions.length > 0 ? (
                "📈 Keep logging sessions to get personalized insights about your activity patterns!"
              ) : (
                "🚀 Complete a few sessions to unlock personalized insights and tips!"
              )}
            </div>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Sessions</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {data.recentSessions.length === 0 ? (
              // Empty state for new users
              <div className="text-center py-12 px-4 text-gray-500">
                <div className="text-5xl mb-4 opacity-50">💪</div>
                <div className="text-lg font-semibold mb-2">No sessions yet</div>
                <div className="text-sm mb-4">
                  Start your first push-up session to see your progress here!
                </div>
                <button
                  onClick={handleStartSession}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-lg font-semibold text-sm hover:from-blue-600 hover:to-blue-800 transition-all duration-200"
                >
                  Start Your First Session
                </button>
              </div>
            ) : (
              data.recentSessions.map((session, index) => (
                <div
                  key={session.id}
                  onClick={() => handleSessionClick(session)}
                  className={`px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors duration-200 ${
                    index < data.recentSessions.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 text-sm mb-1">
                      {session.date}
                    </div>
                    <div className="text-xs text-gray-500">
                      Duration: {session.duration}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-blue-500">
                    {session.reps}
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