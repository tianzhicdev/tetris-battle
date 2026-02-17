import { useState, useEffect, useCallback } from 'react';
import type { UserProfile } from '@tetris-battle/game-core';
import { useFriendStore } from '../stores/friendStore';
import { audioManager } from '../services/audioManager';
import { glassBlue, glassPurple, glassSuccess, glassDanger, glassPanel, mergeGlass } from '../styles/glassUtils';

interface FriendListProps {
  profile: UserProfile;
  onClose: () => void;
  onChallenge: (friendUserId: string, friendUsername: string) => void;
}

type Tab = 'friends' | 'requests' | 'add';

export function FriendList({ profile, onClose, onChallenge }: FriendListProps) {
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [requestUsername, setRequestUsername] = useState('');
  const [requestStatus, setRequestStatus] = useState<string | null>(null);

  const {
    friends,
    pendingRequests,
    searchResults,
    searchLoading,
    friendsLoading,
    loadFriends,
    loadPendingRequests,
    sendRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
    searchUsers,
  } = useFriendStore();

  useEffect(() => {
    loadFriends(profile.userId);
    loadPendingRequests(profile.userId);
  }, [profile.userId, loadFriends, loadPendingRequests]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      searchUsers(searchQuery, profile.userId);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, profile.userId, searchUsers]);

  const handleSendRequest = useCallback(async () => {
    if (!requestUsername.trim()) return;
    audioManager.playSfx('button_click');
    const result = await sendRequest(profile.userId, requestUsername.trim());
    if (result.success) {
      setRequestStatus('Request sent!');
      setRequestUsername('');
      setTimeout(() => setRequestStatus(null), 3000);
    } else {
      const errorMessages: Record<string, string> = {
        USER_NOT_FOUND: 'User not found',
        ALREADY_EXISTS: 'Request already exists',
        BLOCKED: 'Cannot send request',
        CANNOT_ADD_SELF: 'Cannot add yourself',
      };
      setRequestStatus(errorMessages[result.error || ''] || 'Error sending request');
      setTimeout(() => setRequestStatus(null), 3000);
    }
  }, [requestUsername, profile.userId, sendRequest]);

  const handleAccept = useCallback(async (friendshipId: string) => {
    audioManager.playSfx('button_click');
    await acceptRequest(friendshipId, profile.userId);
  }, [acceptRequest, profile.userId]);

  const handleDecline = useCallback(async (friendshipId: string) => {
    audioManager.playSfx('button_click');
    await declineRequest(friendshipId, profile.userId);
  }, [declineRequest, profile.userId]);

  const handleRemove = useCallback(async (friendshipId: string) => {
    audioManager.playSfx('button_click');
    await removeFriend(friendshipId, profile.userId);
  }, [removeFriend, profile.userId]);

  const handleSearchAdd = useCallback(async (username: string) => {
    audioManager.playSfx('button_click');
    const result = await sendRequest(profile.userId, username);
    if (result.success) {
      // Refresh search results
      searchUsers(searchQuery, profile.userId);
    }
  }, [sendRequest, profile.userId, searchUsers, searchQuery]);

  const handleSearchAccept = useCallback(async (userId: string) => {
    // Find the pending request for this user
    const request = pendingRequests.find(r => r.requesterId === userId);
    if (request) {
      audioManager.playSfx('button_click');
      await acceptRequest(request.friendshipId, profile.userId);
      searchUsers(searchQuery, profile.userId);
    }
  }, [pendingRequests, acceptRequest, profile.userId, searchUsers, searchQuery]);

  const statusColor = (status: 'online' | 'in_game' | 'offline') => {
    switch (status) {
      case 'online': return '#00ff88';
      case 'in_game': return '#ffd700';
      case 'offline': return '#666';
    }
  };

  const statusText = (status: 'online' | 'in_game' | 'offline') => {
    switch (status) {
      case 'online': return 'Online';
      case 'in_game': return 'In Game';
      case 'offline': return 'Offline';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.92)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 'clamp(10px, 3vw, 20px)',
    }}>
      <div style={{
        background: 'rgba(10, 10, 30, 0.95)',
        backdropFilter: 'blur(30px)',
        border: '1px solid rgba(0, 212, 255, 0.3)',
        borderRadius: 'clamp(12px, 3vw, 16px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 'clamp(15px, 4vw, 20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <h2 style={{
            margin: 0,
            fontSize: 'clamp(20px, 5vw, 24px)',
            color: '#00d4ff',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            textShadow: '0 0 15px rgba(0, 212, 255, 0.6)',
          }}>
            FRIENDS
          </h2>
          <button
            onClick={() => { audioManager.playSfx('button_click'); onClose(); }}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          {([
            { id: 'friends' as Tab, label: 'Friends', count: friends.length },
            { id: 'requests' as Tab, label: 'Requests', count: pendingRequests.length },
            { id: 'add' as Tab, label: 'Add Friend', count: 0 },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => { audioManager.playSfx('button_click'); setActiveTab(tab.id); }}
              style={{
                flex: 1,
                padding: '12px 8px',
                background: activeTab === tab.id ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #00d4ff' : '2px solid transparent',
                color: activeTab === tab.id ? '#00d4ff' : '#888',
                fontFamily: 'monospace',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              {tab.label}
              {tab.id === 'requests' && tab.count > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '10px',
                  background: '#ff006e',
                  color: '#fff',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  minWidth: '16px',
                  textAlign: 'center',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'clamp(10px, 3vw, 15px)',
        }}>
          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <div>
              {friendsLoading ? (
                <p style={{ textAlign: 'center', color: '#888', fontFamily: 'monospace' }}>Loading...</p>
              ) : friends.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888', fontFamily: 'monospace', padding: '20px 0' }}>
                  No friends yet. Add some friends to play together!
                </p>
              ) : (
                friends.map(friend => (
                  <div key={friend.friendshipId} style={mergeGlass(glassPanel(), {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    marginBottom: '8px',
                    gap: '12px',
                  })}>
                    {/* Avatar */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(0, 212, 255, 0.2)',
                      border: `2px solid ${statusColor(friend.onlineStatus)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: '#00d4ff',
                      fontFamily: 'monospace',
                      flexShrink: 0,
                    }}>
                      {friend.username.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          color: '#fff',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {friend.username}
                        </span>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: statusColor(friend.onlineStatus),
                          boxShadow: `0 0 6px ${statusColor(friend.onlineStatus)}`,
                          flexShrink: 0,
                        }} />
                      </div>
                      <div style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace', marginTop: '2px' }}>
                        Rating {friend.matchmakingRating} · {friend.gamesPlayed} games · {statusText(friend.onlineStatus)}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {friend.onlineStatus === 'online' && (
                        <button
                          onClick={() => { audioManager.playSfx('button_click'); onChallenge(friend.userId, friend.username); }}
                          style={mergeGlass(glassPurple(), {
                            padding: '6px 12px',
                            fontSize: '11px',
                            color: '#c942ff',
                            cursor: 'pointer',
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            borderRadius: '6px',
                            textShadow: '0 0 8px rgba(201, 66, 255, 0.5)',
                          })}
                        >
                          Challenge
                        </button>
                      )}
                      {friend.onlineStatus === 'in_game' && (
                        <span style={{
                          padding: '6px 12px',
                          fontSize: '11px',
                          color: '#ffd700',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                          opacity: 0.7,
                        }}>
                          In Game
                        </span>
                      )}
                      <button
                        onClick={() => handleRemove(friend.friendshipId)}
                        style={{
                          background: 'rgba(255, 0, 110, 0.1)',
                          border: '1px solid rgba(255, 0, 110, 0.3)',
                          color: '#ff006e',
                          padding: '6px 8px',
                          fontSize: '11px',
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          borderRadius: '6px',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            <div>
              {pendingRequests.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888', fontFamily: 'monospace', padding: '20px 0' }}>
                  No pending requests
                </p>
              ) : (
                pendingRequests.map(request => (
                  <div key={request.friendshipId} style={mergeGlass(glassPanel(), {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    marginBottom: '8px',
                    gap: '12px',
                  })}>
                    {/* Avatar */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(0, 255, 157, 0.2)',
                      border: '2px solid rgba(0, 255, 157, 0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: '#00ff9d',
                      fontFamily: 'monospace',
                      flexShrink: 0,
                    }}>
                      {request.username.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        color: '#fff',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        fontSize: '14px',
                      }}>
                        {request.username}
                      </span>
                      <div style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace', marginTop: '2px' }}>
                        Rating {request.matchmakingRating} · {request.gamesPlayed} games
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleAccept(request.friendshipId)}
                        style={mergeGlass(glassSuccess(), {
                          padding: '6px 14px',
                          fontSize: '11px',
                          color: '#00ff88',
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                          borderRadius: '6px',
                          textShadow: '0 0 8px rgba(0, 255, 136, 0.5)',
                        })}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDecline(request.friendshipId)}
                        style={mergeGlass(glassDanger(), {
                          padding: '6px 14px',
                          fontSize: '11px',
                          color: '#ff006e',
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                          borderRadius: '6px',
                        })}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Add Friend Tab */}
          {activeTab === 'add' && (
            <div>
              {/* Direct add by username */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ color: '#888', fontSize: '12px', fontFamily: 'monospace', display: 'block', marginBottom: '6px' }}>
                  Add by username
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={requestUsername}
                    onChange={(e) => setRequestUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
                    placeholder="Enter username..."
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(0, 212, 255, 0.3)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleSendRequest}
                    style={mergeGlass(glassBlue(), {
                      padding: '10px 20px',
                      fontSize: '13px',
                      color: '#00d4ff',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontWeight: 'bold',
                      borderRadius: '8px',
                      textShadow: '0 0 8px rgba(0, 212, 255, 0.5)',
                      whiteSpace: 'nowrap',
                    })}
                  >
                    Send
                  </button>
                </div>
                {requestStatus && (
                  <p style={{
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    marginTop: '6px',
                    color: requestStatus === 'Request sent!' ? '#00ff88' : '#ff006e',
                  }}>
                    {requestStatus}
                  </p>
                )}
              </div>

              {/* Search */}
              <div>
                <label style={{ color: '#888', fontSize: '12px', fontFamily: 'monospace', display: 'block', marginBottom: '6px' }}>
                  Search players
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(0, 212, 255, 0.3)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontFamily: 'monospace',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    marginBottom: '12px',
                  }}
                />

                {searchLoading && (
                  <p style={{ textAlign: 'center', color: '#888', fontFamily: 'monospace' }}>Searching...</p>
                )}

                {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#888', fontFamily: 'monospace' }}>No users found</p>
                )}

                {searchResults.map(user => (
                  <div key={user.userId} style={mergeGlass(glassPanel(), {
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    marginBottom: '8px',
                    gap: '12px',
                  })}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'rgba(0, 212, 255, 0.2)',
                      border: '2px solid rgba(0, 212, 255, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: '#00d4ff',
                      fontFamily: 'monospace',
                      flexShrink: 0,
                    }}>
                      {user.username.charAt(0).toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{
                        color: '#fff',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        fontSize: '13px',
                      }}>
                        {user.username}
                      </span>
                      <div style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace', marginTop: '2px' }}>
                        Rating {user.matchmakingRating} · {user.gamesPlayed} games
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      {user.friendshipStatus === 'none' && (
                        <button
                          onClick={() => handleSearchAdd(user.username)}
                          style={mergeGlass(glassBlue(), {
                            padding: '6px 14px',
                            fontSize: '11px',
                            color: '#00d4ff',
                            cursor: 'pointer',
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            borderRadius: '6px',
                          })}
                        >
                          Add Friend
                        </button>
                      )}
                      {user.friendshipStatus === 'pending_sent' && (
                        <span style={{
                          padding: '6px 14px',
                          fontSize: '11px',
                          color: '#888',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                        }}>
                          Pending
                        </span>
                      )}
                      {user.friendshipStatus === 'pending_received' && (
                        <button
                          onClick={() => handleSearchAccept(user.userId)}
                          style={mergeGlass(glassSuccess(), {
                            padding: '6px 14px',
                            fontSize: '11px',
                            color: '#00ff88',
                            cursor: 'pointer',
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            borderRadius: '6px',
                          })}
                        >
                          Accept
                        </button>
                      )}
                      {user.friendshipStatus === 'accepted' && (
                        <span style={{
                          padding: '6px 14px',
                          fontSize: '11px',
                          color: '#00ff88',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                        }}>
                          Friends
                        </span>
                      )}
                      {user.friendshipStatus === 'blocked' && (
                        <span style={{
                          padding: '6px 14px',
                          fontSize: '11px',
                          color: '#ff006e',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                        }}>
                          Blocked
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
