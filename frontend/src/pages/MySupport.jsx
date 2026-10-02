import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Plus,
  Search,
  ExternalLink,
  Calendar,
  Clock,
  Send,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Headphones,
  User,
  Shield,
  Package,
  ArrowLeft,
  X
} from 'lucide-react';
import BaseLayout from '../components/BaseLayout.jsx';
import Modal from '../components/Modal.jsx';
import { api } from '../utils/api.js';
import { formatDate } from '../utils/formatters.js';
import { getCachedSupportTickets, getMemoryCachedSupportTickets, invalidateSupportCache } from '../utils/metadataCache.js';

const SUPPORT_EMAIL = 'menx001@gmail.com';

export default function MySupport() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const queryKey = `support_${page}_${statusFilter}_${categoryFilter}`;
  const initialCached = getMemoryCachedSupportTickets(queryKey);

  const [tickets, setTickets] = useState(initialCached?.tickets || []);
  const [loading, setLoading] = useState(!initialCached);
  const [error, setError] = useState(null);
  const [totalPages, setTotalPages] = useState(initialCached?.pagination?.totalPages || 1);
  const [totalCount, setTotalCount] = useState(initialCached?.pagination?.total || 0);

  // Selected Ticket Detail Modal
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    let isMounted = true;

    async function fetchTickets() {
      const cached = getMemoryCachedSupportTickets(queryKey);
      if (cached) {
        setTickets(cached.tickets || []);
        setTotalPages(cached.pagination?.totalPages || 1);
        setTotalCount(cached.pagination?.total || 0);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const query = `/support?page=${page}&limit=10${statusFilter ? `&status=${statusFilter}` : ''}${categoryFilter ? `&category=${categoryFilter}` : ''}`;
        const data = await getCachedSupportTickets(queryKey, async () => {
          const res = await api.get(query, { signal: controller.signal });
          return res.data;
        });
        if (isMounted && !controller.signal.aborted) {
          setTickets(data?.tickets || []);
          setTotalPages(data?.pagination?.totalPages || 1);
          setTotalCount(data?.pagination?.total || 0);
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 20) return;
        console.error('Failed to fetch support tickets:', err.message);
        if (isMounted && !cached) {
          setError(err.data?.message || err.message || 'Failed to load support requests');
        }
      } finally {
        if (isMounted && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchTickets();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [page, statusFilter, categoryFilter, queryKey]);

  const openTicketDetails = async (ticket) => {
    setSelectedTicket(ticket);
    setLoadingDetails(true);
    setDetailsError(null);
    setReplyError(null);
    setReplyMessage('');

    try {
      const res = await api.get(`/support/${ticket.id}`);
      setSelectedTicket(res.data?.data || res.data);
    } catch (err) {
      console.error('Failed to fetch ticket details:', err.message);
      setDetailsError(err.data?.message || err.message || 'Failed to load ticket conversation');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicket) return;

    setSendingReply(true);
    setReplyError(null);

    try {
      const res = await api.post(`/support/${selectedTicket.id}/messages`, {
        message: replyMessage.trim()
      });

      const newMsg = res.data?.data || res.data;
      setSelectedTicket(prev => ({
        ...prev,
        messages: [...(prev.messages || []), newMsg]
      }));
      setReplyMessage('');
      invalidateSupportCache();
      fetchTickets(); // Refresh list last updated time
    } catch (err) {
      setReplyError(err.data?.message || err.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'OPEN':
        return 'bg-menx-info/10 border-menx-info/20 text-menx-info';
      case 'IN_PROGRESS':
        return 'bg-menx-primary/10 border-menx-primary/20 text-menx-primary';
      case 'RESOLVED':
        return 'bg-menx-success/10 border-menx-success/20 text-menx-success';
      case 'CLOSED':
        return 'bg-gray-500/10 border-gray-500/20 text-menx-text-secondary';
      default:
        return 'bg-gray-500/10 border-gray-500/20 text-menx-text-secondary';
    }
  };

  return (
    <BaseLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-grow space-y-8 w-full">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-menx-border pb-4">
          <div className="space-y-1">
            <Link
              to="/help"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-menx-text-secondary hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Help Center</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center space-x-2">
              <MessageSquare className="w-7 h-7 text-menx-primary" />
              <span>MY SUPPORT REQUESTS</span>
            </h1>
            <p className="text-xs sm:text-sm text-menx-text-secondary font-medium">
              View and track all your submitted customer inquiries and direct support threads.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <Link
              to="/help"
              className="py-2.5 px-4 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-extrabold rounded-xl text-xs transition-colors flex items-center space-x-1.5 uppercase tracking-wider shadow-md shadow-menx-primary/10"
            >
              <Plus className="w-4 h-4" />
              <span>New Support Request</span>
            </Link>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 menx-card p-4 rounded-2xl shadow-md text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-menx-text-secondary font-bold uppercase tracking-wider text-[10px]">Filter By:</span>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-menx-surface-elevated border border-menx-border text-white p-2 rounded-xl font-bold focus:outline-none focus:border-menx-primary"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="bg-menx-surface-elevated border border-menx-border text-white p-2 rounded-xl font-bold focus:outline-none focus:border-menx-primary"
            >
              <option value="">All Categories</option>
              <option value="ORDER">Order Issue</option>
              <option value="SHIPPING">Shipping & Delivery</option>
              <option value="PAYMENT">Payment / COD</option>
              <option value="RETURN">Return & Refund</option>
              <option value="EXCHANGE">Size Exchange</option>
              <option value="PRODUCT">Product Inquiry</option>
              <option value="ACCOUNT">Account & Login</option>
              <option value="CART_WISHLIST">Cart & Wishlist</option>
              <option value="OTHER">Other Support</option>
            </select>
          </div>

          <div className="text-menx-text-secondary font-medium">
            Showing <strong className="text-white">{tickets.length}</strong> of <strong className="text-menx-primary font-mono">{totalCount}</strong> requests
          </div>
        </div>

        {/* Content Area */}
        {loading && tickets.length === 0 ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="menx-card p-6 rounded-2xl animate-pulse space-y-4">
                <div className="flex justify-between">
                  <div className="flex gap-2">
                    <div className="h-4 bg-menx-surface-elevated rounded w-24" />
                    <div className="h-4 bg-menx-surface-elevated rounded w-16" />
                  </div>
                  <div className="h-3 bg-menx-surface-elevated rounded w-32" />
                </div>
                <div className="h-4 bg-menx-surface-elevated rounded w-1/2" />
                <div className="h-3 bg-menx-surface-elevated rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-menx-error/10 border border-menx-error/20 text-menx-error p-8 rounded-2xl text-center space-y-3 max-w-md mx-auto shadow-lg">
            <AlertTriangle className="w-8 h-8 mx-auto text-menx-error" />
            <h3 className="text-base font-bold text-white">Failed to load support requests</h3>
            <p className="text-xs text-menx-text-secondary">{error}</p>
            <button
              onClick={fetchTickets}
              className="px-4 py-2 bg-menx-surface hover:bg-menx-surface-elevated text-white rounded-lg text-xs font-bold border border-menx-border transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="menx-card rounded-2xl p-12 text-center space-y-4 shadow-md max-w-lg mx-auto">
            <div className="w-14 h-14 bg-menx-primary/10 border border-menx-primary/20 rounded-full flex items-center justify-center mx-auto text-menx-primary">
              <Headphones className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">No Support Requests Found</h3>
              <p className="text-xs text-menx-text-secondary leading-relaxed font-medium">
                You haven't submitted any support requests matching this filter. If you have a question or need assistance, submit a new ticket.
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/help"
                className="py-2.5 px-5 bg-menx-primary hover:bg-menx-primary-hover text-[#0B0F14] font-extrabold rounded-xl text-xs inline-flex items-center space-x-1.5 uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                <span>Create Support Request</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="menx-card hover:border-menx-primary/40 p-5 sm:p-6 rounded-2xl transition-all duration-150 shadow-md space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-sm sm:text-base font-black text-white font-mono">
                        {ticket.ticket_number}
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${getStatusBadge(ticket.status)}`}>
                        {ticket.status}
                      </span>
                      <span className="text-[10px] font-bold bg-menx-surface-elevated border border-menx-border text-menx-text-secondary px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                        {ticket.category.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="text-xs text-menx-text-secondary flex items-center space-x-3">
                      <span className="flex items-center space-x-1 font-mono text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-menx-text-muted" />
                        <span>{formatDate(ticket.created_at, true)}</span>
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-white break-words">
                      {ticket.subject}
                    </h3>
                    <p className="text-xs text-menx-text-secondary line-clamp-2 leading-relaxed font-medium">
                      {ticket.message}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-menx-border/60 text-xs">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-menx-text-secondary">
                      {ticket.order_number && (
                        <span className="flex items-center space-x-1">
                          <span>Order:</span>
                          <Link
                            to={`/orders/${ticket.order_id}`}
                            className="text-menx-primary hover:text-menx-primary-hover font-mono font-bold inline-flex items-center space-x-1"
                          >
                            <span>{ticket.order_number}</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </span>
                      )}
                      <span className="flex items-center space-x-1 text-menx-text-muted">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Updated: {formatDate(ticket.updated_at, true)}</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => openTicketDetails(ticket)}
                      className="py-2 px-4 bg-menx-surface-elevated hover:bg-menx-surface-elevated border border-menx-border hover:border-menx-border text-menx-primary hover:text-menx-primary-hover rounded-xl font-bold transition-colors flex items-center space-x-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>VIEW DETAILS ({ticket.message_count || 1})</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center text-xs pt-4 border-t border-menx-border">
                <span className="text-menx-text-muted font-medium">
                  Page {page} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    className="px-4 py-2 bg-menx-surface hover:bg-menx-surface-elevated disabled:bg-menx-surface-elevated disabled:text-menx-text-muted border border-menx-border rounded-xl font-bold text-white transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(prev => prev + 1)}
                    className="px-4 py-2 bg-menx-surface hover:bg-menx-surface-elevated disabled:bg-menx-surface-elevated disabled:text-menx-text-muted border border-menx-border rounded-xl font-bold text-white transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Selected Ticket Conversation Modal */}
        <Modal
          isOpen={Boolean(selectedTicket)}
          onClose={() => setSelectedTicket(null)}
          maxWidth="max-w-3xl"
          customHeader={selectedTicket ? (
            <div className="p-5 sm:p-6 border-b border-menx-border flex items-start justify-between gap-4 bg-menx-bg/95 shrink-0">
              <div className="space-y-1.5 min-w-0 pr-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-black text-white font-mono">
                    #{selectedTicket.ticket_number}
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${getStatusBadge(selectedTicket.status)}`}>
                    {selectedTicket.status}
                  </span>
                  <span className="text-[10px] font-bold bg-menx-surface border border-menx-border text-menx-text-secondary px-2 py-0.5 rounded uppercase">
                    {selectedTicket.category?.replace(/_/g, ' ')}
                  </span>
                </div>
                <h2 className="text-base font-bold text-white break-words">
                  {selectedTicket.subject}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 text-menx-text-secondary hover:text-white hover:bg-menx-surface-elevated rounded-lg border border-menx-border transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : null}
          footer={selectedTicket ? (
            <div className="w-full">
              {selectedTicket.status === 'CLOSED' ? (
                <div className="p-3 bg-menx-surface border border-menx-border text-menx-text-secondary rounded-xl text-center text-xs">
                  This support ticket has been closed. If you have any further questions, please create a new ticket.
                </div>
              ) : (
                <form onSubmit={handleSendReply} className="space-y-3">
                  {replyError && (
                    <p className="text-menx-error text-xs">{replyError}</p>
                  )}
                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      required
                      disabled={sendingReply}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your reply to customer support..."
                      className="w-full bg-menx-surface-elevated border border-menx-border focus:border-menx-primary rounded-xl p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-menx-primary font-medium"
                    />
                    <button
                      type="submit"
                      disabled={sendingReply || !replyMessage.trim()}
                      className="px-5 bg-menx-primary hover:bg-menx-primary-hover disabled:bg-menx-surface-elevated disabled:text-menx-text-muted text-[#0B0F14] font-extrabold rounded-xl text-xs transition-colors flex items-center justify-center shrink-0"
                    >
                      {sendingReply ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}
        >
          {selectedTicket && (
            <div className="space-y-6 text-xs">
              {/* Meta details bar */}
              <div className="p-4 bg-menx-surface-elevated border border-menx-border rounded-xl flex flex-wrap items-center justify-between gap-4 text-[11px] text-menx-text-secondary">
                <div className="space-y-1">
                  <div>Created: <span className="text-menx-text font-mono">{formatDate(selectedTicket.created_at, true)}</span></div>
                  {selectedTicket.order_number && (
                    <div>
                      Linked Order: <Link to={`/orders/${selectedTicket.order_id}`} className="text-menx-primary font-bold font-mono hover:underline">{selectedTicket.order_number}</Link>
                    </div>
                  )}
                </div>
                <div className="text-right space-y-1">
                  {selectedTicket.resolved_at && (
                    <div className="text-menx-success font-medium">Resolved: {formatDate(selectedTicket.resolved_at, true)}</div>
                  )}
                  {selectedTicket.closed_at && (
                    <div className="text-menx-text-muted font-medium">Closed: {formatDate(selectedTicket.closed_at, true)}</div>
                  )}
                </div>
              </div>

              {loadingDetails ? (
                <div className="py-12 flex justify-center items-center space-x-2 text-menx-text-muted">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-menx-primary" />
                  <span>Loading conversation history...</span>
                </div>
              ) : detailsError ? (
                <div className="p-4 bg-menx-error/10 border border-menx-error/20 text-menx-error rounded-xl text-center">
                  {detailsError}
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="font-bold text-menx-text-secondary uppercase tracking-wider text-[11px] border-b border-menx-border pb-2">
                    Conversation Thread
                  </h4>

                  {/* Messages list */}
                  <div className="space-y-4">
                    {(selectedTicket.messages || []).map((msg) => {
                      const isAdmin = msg.sender_type === 'ADMIN';

                      return (
                        <div
                          key={msg.id}
                          className={`p-4 rounded-2xl border space-y-2 ${
                            isAdmin
                              ? 'bg-menx-primary/5 border-menx-primary/20 ml-4 sm:ml-8'
                              : 'bg-menx-surface-elevated border-menx-border mr-4 sm:mr-8'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-menx-border/60 pb-1.5">
                            <div className="flex items-center space-x-2">
                              {isAdmin ? (
                                <div className="w-5 h-5 rounded-full bg-menx-primary text-[#0B0F14] flex items-center justify-center font-bold text-[10px]">
                                  <Shield className="w-3 h-3" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-menx-surface-elevated text-menx-primary flex items-center justify-center font-bold text-[10px]">
                                  <User className="w-3 h-3" />
                                </div>
                              )}
                              <span className="font-bold text-white text-xs">
                                {isAdmin ? 'MENX Support Team' : `${msg.first_name || 'You'} ${msg.last_name || ''}`}
                              </span>
                              {isAdmin && (
                                <span className="text-[9px] bg-menx-primary text-[#0B0F14] font-black px-1.5 py-0.2 rounded font-mono uppercase">
                                  Official
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-menx-text-muted font-mono">
                              {formatDate(msg.created_at, true)}
                            </span>
                          </div>

                          <p className="text-menx-text whitespace-pre-wrap leading-relaxed font-medium break-words">
                            {msg.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

      </div>
    </BaseLayout>
  );
}
