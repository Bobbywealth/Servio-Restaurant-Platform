// Kitchen Assistant Panel - Tablet UI
// Servio AI Kitchen Assistant

import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import VoiceInput from '@/components/Assistant/VoiceInput';
import { KitchenSession, CookingTimer, Recipe } from './types';

interface KitchenAssistantPanelProps {
  companyId: number;
  deviceId?: string;
}

export default function KitchenAssistantPanel({ companyId, deviceId }: KitchenAssistantPanelProps) {
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<KitchenSession[]>([]);
  const [timers, setTimers] = useState<CookingTimer[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedSession, setSelectedSession] = useState<KitchenSession | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRecipeSelector, setShowRecipeSelector] = useState(false);

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

  useEffect(() => {
    fetchSessions();
    fetchRecipes();
    fetchTimers();

    // Poll for updates
    const interval = setInterval(() => {
      fetchSessions();
      fetchTimers();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchSessions, fetchRecipes, fetchTimers]);

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
      {/* Header */}
      <div className={`p-4 border-b ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                Servio AI Kitchen
              </h1>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                Voice-Powered Cooking Assistant
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
        {/* Active Recipes List */}
        <div className={`w-80 border-r overflow-y-auto ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
          <div className="p-4">
            <h2 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              Active Recipes
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
                {sessions.map((session) => {
                  const timer = getSessionTimer(session.session.id);
                  return (
                    <div
                      key={session.session.id}
                      onClick={() => setSelectedSession(session)}
                      className={`p-4 rounded-lg cursor-pointer transition-all ${
                        selectedSession?.session.id === session.session.id
                          ? 'bg-green-600 text-white'
                          : theme === 'dark'
                          ? 'bg-gray-700 hover:bg-gray-600'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold">{session.recipe.dish_name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          session.session.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {session.session.status}
                        </span>
                      </div>
                      <p className={`text-sm ${selectedSession?.session.id === session.session.id ? 'text-green-100' : ''}`}>
                        Step {session.session.current_step}: {session.currentStepInstruction.substring(0, 40)}...
                      </p>
                      {timer && (
                        <div className={`mt-2 flex items-center text-sm ${
                          selectedSession?.session.id === session.session.id ? 'text-green-100' : 'text-gray-500'
                        }`}>
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTime(timer.remaining_seconds)}
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

                  {/* Timer Display */}
                  {(() => {
                    const timer = getSessionTimer(selectedSession.session.id);
                    if (timer) {
                      return (
                        <div className={`text-center p-8 rounded-2xl ${
                          timer.remaining_seconds < 60 
                            ? 'bg-red-500 animate-pulse' 
                            : 'bg-green-600'
                        } text-white`}>
                          <div className="text-6xl font-bold mb-2">
                            {formatTime(timer.remaining_seconds)}
                          </div>
                          <div className="text-green-100">
                            {timer.halfway_completed ? 'More than halfway done!' : 'Cooking...'}
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
                <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <h3 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Welcome to AI Kitchen Assistant
                </h3>
                <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                  Select a recipe to start cooking or tap the microphone to speak
                </p>
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

      {/* Recipe Selector Modal */}
      {showRecipeSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl ${
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

              <div className="grid grid-cols-2 gap-4">
                {recipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => startRecipe(recipe)}
                    disabled={isLoading}
                    className={`p-4 rounded-lg text-left transition-all ${
                      theme === 'dark'
                        ? 'bg-gray-700 hover:bg-gray-600'
                        : 'bg-gray-100 hover:bg-gray-200'
                    } ${isLoading ? 'opacity-50' : ''}`}
                  >
                    <h3 className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                      {recipe.dish_name}
                    </h3>
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                      {(recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0)} min • {recipe.difficulty}
                    </p>
                    <p className={`text-xs mt-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                      {recipe.servings} servings
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
