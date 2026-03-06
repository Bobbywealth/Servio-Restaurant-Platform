// Kitchen Assistant Panel - Tablet UI
// Servio AI Kitchen Assistant

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import VoiceInput from '@/components/Assistant/VoiceInput';
import { KitchenSession, CookingTimer, Recipe, RecipeCategory } from './types';

interface KitchenAssistantPanelProps {
  companyId: number;
  deviceId?: string;
}

export default function KitchenAssistantPanel({ companyId, deviceId }: KitchenAssistantPanelProps) {
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<KitchenSession[]>([]);
  const [timers, setTimers] = useState<CookingTimer[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<KitchenSession | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);
  
  // Real-time countdown timers (client-side for smooth updates)
  const [localTimers, setLocalTimers] = useState<Record<number, number>>({});
  const timerIntervals = useRef<Record<number, NodeJS.Timeout>>({});

  // Fetch active sessions
  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch(`/api/kitchen-assistant/sessions?companyId=${companyId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    }
  }, [companyId]);

  // Fetch recipes
  const fetchRecipes = useCallback(async () => {
    try {
      const response = await fetch(`/api/kitchen-assistant/recipes?companyId=${companyId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setRecipes(data.recipes || []);
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    }
  }, [companyId]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch(`/api/kitchen-assistant/categories?companyId=${companyId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, [companyId]);

  // Fetch timers
  const fetchTimers = useCallback(async () => {
    try {
      const response = await fetch(`/api/kitchen-assistant/timers?companyId=${companyId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setTimers(data.timers || []);
    } catch (error) {
      console.error('Failed to fetch timers:', error);
    }
  }, [companyId]);

  // Start local countdown timer for a session
  const startLocalTimer = useCallback((sessionId: number, initialSeconds: number) => {
    // Clear existing interval if any
    if (timerIntervals.current[sessionId]) {
      clearInterval(timerIntervals.current[sessionId]);
    }
    
    // Set initial value
    setLocalTimers(prev => ({ ...prev, [sessionId]: initialSeconds }));
    
    // Start countdown
    timerIntervals.current[sessionId] = setInterval(() => {
      setLocalTimers(prev => {
        const current = prev[sessionId] || 0;
        if (current <= 0) {
          clearInterval(timerIntervals.current[sessionId]);
          delete timerIntervals.current[sessionId];
          return prev;
        }
        return { ...prev, [sessionId]: current - 1 };
      });
    }, 1000);
  }, []);

  // Stop local timer
  const stopLocalTimer = useCallback((sessionId: number) => {
    if (timerIntervals.current[sessionId]) {
      clearInterval(timerIntervals.current[sessionId]);
      delete timerIntervals.current[sessionId];
    }
  }, []);

  // Get timer display value (prefer local timer for smooth countdown)
  const getTimerDisplay = useCallback((sessionId: number, serverSeconds: number): number => {
    if (localTimers[sessionId] !== undefined) {
      return localTimers[sessionId];
    }
    return serverSeconds;
  }, [localTimers]);

  // Control timer (start, pause, resume, cancel)
  const controlTimer = async (sessionId: number, action: 'start' | 'pause' | 'resume' | 'cancel') => {
    try {
      const response = await fetch(`/api/kitchen-assistant/timers/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionId,
          companyId,
          deviceId
        })
      });
      
      const data = await response.json();
      
      if (action === 'pause' || action === 'cancel') {
        stopLocalTimer(sessionId);
      } else if (action === 'start' || action === 'resume') {
        const timer = timers.find(t => t.session_id === sessionId);
        if (timer) {
          startLocalTimer(sessionId, timer.remaining_seconds);
        }
      }
      
      fetchTimers();
    } catch (error) {
      console.error(`Failed to ${action} timer:`, error);
    }
  };

  // Get filtered recipes by category
  const getFilteredRecipes = useCallback(() => {
    if (selectedCategory === null) {
      return recipes;
    }
    return recipes.filter(r => r.category_id === selectedCategory);
  }, [recipes, selectedCategory]);

  // Reset category when closing modal
  useEffect(() => {
    if (!showRecipeSelector) {
      setSelectedCategory(null);
    }
  }, [showRecipeSelector]);

  useEffect(() => {
    fetchSessions();
    fetchRecipes();
    fetchCategories();
    fetchTimers();

    // Poll for updates
    const interval = setInterval(() => {
      fetchSessions();
      fetchTimers();
    }, 5000);

    return () => {
      clearInterval(interval);
      // Clean up all timer intervals
      Object.values(timerIntervals.current).forEach(clearInterval);
    };
  }, [fetchSessions, fetchRecipes, fetchCategories, fetchTimers]);

  // Set up local timers when server timers are fetched
  useEffect(() => {
    timers.forEach(timer => {
      if (timer.status === 'running' && timer.remaining_seconds > 0) {
        // Start local countdown if not already running
        if (localTimers[timer.session_id] === undefined) {
          startLocalTimer(timer.session_id, timer.remaining_seconds);
        }
      } else if (timer.status === 'paused' || timer.status === 'completed') {
        stopLocalTimer(timer.session_id);
      }
    });
  }, [timers, localTimers, startLocalTimer, stopLocalTimer]);

  // Handle voice command
  const handleVoiceCommand = async (text: string) => {
    setIsLoading(true);
    setTranscript(text);

    try {
      const response = await fetch('/api/kitchen-assistant/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          text,
          sessionId: selectedSession?.session?.id,
          recipeId: selectedSession?.recipe?.id,
          companyId,
          deviceId
        })
      });

      const data = await response.json();
      setAiResponse(data.response);

      if (data.data?.session) {
        setSelectedSession(data.data.session);
      }

      fetchSessions();
    } catch (error) {
      console.error('Failed to process command:', error);
      setAiResponse('Sorry, I had trouble processing that command. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Start a recipe
  const startRecipe = async (recipe: Recipe) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/kitchen-assistant/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          recipeId: recipe.id,
          companyId,
          deviceId
        })
      });

      const data = await response.json();
      setSelectedSession(data.session);
      setAiResponse(data.response);
      setShowRecipeSelector(false);
      fetchSessions();
    } catch (error) {
      console.error('Failed to start recipe:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Get timer for session
  const getSessionTimer = (sessionId: number): CookingTimer | undefined => {
    return timers.find(t => t.session_id === sessionId && t.status === 'running');
  };

  return (
    <div className={`h-full flex flex-col ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Header with Servio Logo */}
      <div className={`p-4 border-b ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img 
              src="/images/servio_logo_transparent_tight.png" 
              alt="Servio Logo" 
              className="h-10 w-auto"
            />
            <div>
              <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                AI Kitchen Assistant
              </h1>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Voice-Powered Cooking • {sessions.length} active pot{sessions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowRecipeSelector(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
          >
            + Start Recipe
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Active Recipes List - Multiple Pots */}
        <div className={`w-80 border-r overflow-y-auto ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
          <div className="p-4">
            <h2 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Active Pots ({sessions.length})
            </h2>

            {sessions.length === 0 ? (
              <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <p>No active recipes</p>
                <p className="text-sm mt-1">Tap "Start Recipe" to begin</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session, index) => {
                  const timer = getSessionTimer(session.session.id);
                  const localTime = localTimers[session.session.id];
                  const displayTime = timer ? getTimerDisplay(session.session.id, timer.remaining_seconds) : null;
                  const isLowTime = displayTime !== null && displayTime < 60;
                  
                  return (
                    <div
                      key={session.session.id}
                      onClick={() => setSelectedSession(session)}
                      className={`p-4 rounded-lg cursor-pointer transition-all border-l-4 ${
                        selectedSession?.session.id === session.session.id
                          ? 'bg-green-600 text-white border-green-300'
                          : theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600 border-gray-600'
                          : 'bg-gray-100 hover:bg-gray-200 border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-2 ${
                            selectedSession?.session.id === session.session.id
                              ? 'bg-green-300 text-green-900'
                              : 'bg-gray-500 text-white'
                          }`}>
                            {index + 1}
                          </span>
                          <h3 className="font-semibold">{session.recipe.dish_name}</h3>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          session.session.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {session.session.status}
                        </span>
                      </div>
                      <p className={`text-sm ml-8 ${selectedSession?.session.id === session.session.id ? 'text-green-100' : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                        Step {session.session.current_step}: {session.currentStepInstruction.substring(0, 35)}...
                      </p>
                      {displayTime !== null && (
                        <div className={`mt-2 ml-8 flex items-center text-sm font-mono ${
                          selectedSession?.session.id === session.session.id 
                            ? 'text-green-100' 
                            : isLowTime 
                              ? 'text-red-500 font-bold animate-pulse'
                              : 'text-gray-500'
                        }`}>
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTime(displayTime)}
                          {timer?.status === 'paused' && <span className="ml-1 text-xs">(paused)</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col">
          {selectedSession ? (
            <>
              {/* Current Step */}
              <div className={`flex-1 p-6 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
                <div className="max-w-2xl mx-auto">
                  <div className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                    {selectedSession.recipe.dish_name} • Step {selectedSession.session.current_step} of {selectedSession.recipe.steps?.length || 0}
                  </div>
                  
                  <h2 className={`text-3xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    {selectedSession.currentStepInstruction}
                  </h2>

                  {selectedSession.recipe.steps?.[selectedSession.session.current_step - 1]?.notes && (
                    <div className={`p-4 rounded-lg mb-6 ${
                      theme === 'dark' ? 'bg-yellow-900/30 border border-yellow-700' : 'bg-yellow-50 border border-yellow-200'
                    }`}>
                      <p className={`text-sm ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-800'}`}>
                        <strong>Note:</strong> {selectedSession.recipe.steps?.[selectedSession.session.current_step - 1]?.notes}
                      </p>
                    </div>
                  )}

                  {/* Timer Display with Real Countdown */}
                  {(() => {
                    const timer = getSessionTimer(selectedSession.session.id);
                    if (timer) {
                      const localTime = localTimers[selectedSession.session.id];
                      const displayTime = localTime !== undefined ? localTime : timer.remaining_seconds;
                      const isLowTime = displayTime < 60;
                      
                      return (
                        <div className={`text-center p-6 rounded-2xl mb-6 ${
                          isLowTime 
                            ? 'bg-red-500 animate-pulse' 
                            : timer.status === 'paused'
                              ? 'bg-yellow-500'
                              : 'bg-green-600'
                        } text-white`}>
                          <div className="text-6xl font-bold mb-2 font-mono">
                            {formatTime(displayTime)}
                          </div>
                          <div className="text-green-100 mb-4">
                            {timer.halfway_completed ? '✓ More than halfway done!' : timer.status === 'paused' ? '⏸ Timer Paused' : '⏱ Timer Running'}
                          </div>
                          {/* Timer Controls */}
                          <div className="flex justify-center gap-3">
                            {timer.status === 'running' ? (
                              <button
                                onClick={() => controlTimer(selectedSession.session.id, 'pause')}
                                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors"
                              >
                                ⏸ Pause
                              </button>
                            ) : timer.status === 'paused' ? (
                              <button
                                onClick={() => controlTimer(selectedSession.session.id, 'resume')}
                                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors"
                              >
                                ▶ Resume
                              </button>
                            ) : null}
                            <button
                              onClick={() => controlTimer(selectedSession.session.id, 'cancel')}
                              className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-medium transition-colors"
                            >
                              ✕ Cancel
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Quick Actions */}
                  <div className="flex gap-4 mt-8">
                    <button
                      onClick={() => handleVoiceCommand('Next step')}
                      className="flex-1 py-3 px-6 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Next Step
                    </button>
                    <button
                      onClick={() => handleVoiceCommand('Repeat step')}
                      className={`py-3 px-6 rounded-lg font-medium transition-colors ${
                        theme === 'dark' 
                          ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                      }`}
                    >
                      Repeat
                    </button>
                    <button
                      onClick={() => handleVoiceCommand('Show ingredients')}
                      className={`py-3 px-6 rounded-lg font-medium transition-colors ${
                        theme === 'dark' 
                          ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                      }`}
                    >
                      Ingredients
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className={`flex-1 flex items-center justify-center ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
              <div className="text-center">
                <img 
                  src="/images/servio_logo_transparent_tight.png" 
                  alt="Servio Logo" 
                  className="h-20 w-auto mx-auto mb-6"
                />
                <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Welcome to Servio AI Kitchen
                </h3>
                <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  Select a recipe to start cooking or tap the microphone to speak
                </p>
                <button
                  onClick={() => setShowRecipeSelector(true)}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  Browse Recipes
                </button>
              </div>
            </div>
          )}

          {/* Voice Input Area */}
          <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVoiceCommand(transcript)}
                placeholder="Type a command... (e.g., 'Start jerk chicken')"
                className={`flex-1 px-4 py-2 rounded-lg border ${
                  theme === 'dark' 
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
              <button
                onClick={() => handleVoiceCommand(transcript)}
                className={`px-4 py-2 rounded-lg font-medium ${
                  theme === 'dark'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                Send
              </button>
            </div>

            {(transcript || aiResponse) && (
              <div className="mt-4 space-y-2">
                {transcript && (
                  <div className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    <span className="font-medium">You:</span> {transcript}
                  </div>
                )}
                {aiResponse && (
                  <div className={`text-sm ${theme === 'dark' ? 'text-green-400' : 'text-green-700'}`}>
                    <span className="font-medium">Servio:</span> {aiResponse}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recipe Selector Modal with Categories */}
      {showRecipeSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl ${
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Select a Recipe
                </h2>
                <button
                  onClick={() => setShowRecipeSelector(false)}
                  className={`p-2 rounded-lg ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Category Tabs */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === null
                        ? 'bg-green-600 text-white'
                        : theme === 'dark'
                          ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    All Recipes ({recipes.length})
                  </button>
                  {categories.map((category) => {
                    const count = recipes.filter(r => r.category_id === category.id).length;
                    return (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          selectedCategory === category.id
                            ? 'bg-green-600 text-white'
                            : theme === 'dark'
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {category.name} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Recipe Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {getFilteredRecipes().map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => startRecipe(recipe)}
                    disabled={isLoading}
                    className={`p-4 rounded-lg text-left transition-all hover:scale-[1.02] ${
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600'
                        : 'bg-gray-100 hover:bg-gray-200'
                    } ${isLoading ? 'opacity-50' : ''}`}
                  >
                    {recipe.image_url && (
                      <img 
                        src={recipe.image_url} 
                        alt={recipe.dish_name}
                        className="w-full h-24 object-cover rounded-lg mb-3"
                      />
                    )}
                    <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {recipe.dish_name}
                    </h3>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)} min • {recipe.difficulty}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                        {recipe.servings} servings
                      </p>
                      {recipe.cuisine_type && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          theme === 'dark' ? 'bg-gray-600 text-gray-300' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {recipe.cuisine_type}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {getFilteredRecipes().length === 0 && (
                <div className={`text-center py-8 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  <p>No recipes found in this category</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
