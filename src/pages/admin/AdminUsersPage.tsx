import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShieldPlus, ShieldMinus, Ban, RotateCcw } from 'lucide-react';
import { useAdminUsers, useSetUserRole, useBanUser, useUnbanUser } from '@/hooks/useAdminUsers';
import { useSessionContext } from '@/context/SessionContext';
import AdminNav from '@/components/admin/AdminNav';
import BanModal from '@/components/admin/BanModal';
import RoleModal from '@/components/admin/RoleModal';
import UnbanModal from '@/components/admin/UnbanModal';
import Avatar from '@/components/common/Avatar';
import { inputStyle } from '@/styles/forms';
import type { AdminUser, UserRole } from '@/lib/api';

// Mirror of the backend canBan hierarchy, used only to hide controls the server
// would reject anyway. Authorization is always enforced server-side.
const canBan = (actorRole: UserRole, target: AdminUser): boolean => {
  if (target.role === 'admin') return false;
  if (actorRole === 'admin') return true;
  if (actorRole === 'moderator') return target.role === 'user';
  return false;
};

const ROLE_LABEL: Record<UserRole, string> = {
  user: 'Пользователь',
  moderator: 'Модератор',
  admin: 'Гл. админ',
};

const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
  const color = role === 'admin' ? 'var(--accent)' : role === 'moderator' ? '#d08700' : 'var(--text-3)';
  return (
    <span style={{
      fontSize: 11, fontFamily: 'var(--font-mono)', color,
      border: `1px solid ${color}`, borderRadius: 6, padding: '1px 6px',
    }}>{ROLE_LABEL[role]}</span>
  );
};

const AdminUsersPage: React.FC = () => {
  const session = useSessionContext();
  const actorRole = (session?.user.role as UserRole) ?? 'user';
  const isAdmin = actorRole === 'admin';
  const selfId = session?.user.id;

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: users, isLoading, isFetching, error } = useAdminUsers(debounced || undefined);
  const setRole = useSetUserRole();
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();

  // Users currently targeted by the modals (null = modal closed).
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [unbanTarget, setUnbanTarget] = useState<AdminUser | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);

  const roleNext: 'user' | 'moderator' = roleTarget?.role === 'moderator' ? 'user' : 'moderator';

  const confirmRole = () => {
    if (!roleTarget) return;
    setRole.mutate(
      { id: roleTarget.id, role: roleNext },
      { onSuccess: () => setRoleTarget(null) },
    );
  };

  const confirmBan = (reason: string, durationDays: number) => {
    if (!banTarget) return;
    banUser.mutate(
      { id: banTarget.id, reason, durationDays },
      { onSuccess: () => setBanTarget(null) },
    );
  };

  const confirmUnban = () => {
    if (!unbanTarget) return;
    unbanUser.mutate(unbanTarget.id, { onSuccess: () => setUnbanTarget(null) });
  };

  const busyId =
    (setRole.isPending && setRole.variables?.id) ||
    (banUser.isPending && banUser.variables?.id) ||
    (unbanUser.isPending && (unbanUser.variables as string));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 820, margin: '0 auto' }}>
      <AdminNav />

      <div style={{ position: 'relative', maxWidth: 440 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Поиск по email или нику…"
          style={{ ...inputStyle, paddingLeft: 32, paddingRight: query ? 56 : 10 }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {isFetching && (
          <span style={{ position: 'absolute', right: 30, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>…</span>
        )}
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Очистить"
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 16, lineHeight: 1, padding: 2 }}
          >×</button>
        )}
      </div>

      {isLoading && <div className="mono text-secondary">ЗАГРУЗКА...</div>}
      {error && <div className="mono" style={{ color: 'var(--error)' }}>{(error as Error).message}</div>}

      {users && users.length === 0 && !isLoading && (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="text-secondary">{debounced ? `Ничего не найдено по запросу «${debounced}».` : 'Пользователей нет.'}</div>
        </div>
      )}

      {users && users.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            {debounced ? `Найдено: ${users.length}` : `Всего: ${users.length}`}
          </div>
          {users.map((u) => {
            const banned = u.status === 'suspended';
            const isSelf = u.id === selfId;
            const showRoleBtn = isAdmin && !isSelf && u.role !== 'admin';
            const showBanBtns = !isSelf && canBan(actorRole, u);
            const busy = busyId === u.id;
            return (
              <div key={u.id} style={{
                background: 'var(--bg-1)', border: '1px solid var(--border)',
                borderRadius: 'var(--card-radius)', padding: 14,
                display: 'flex', gap: 12, alignItems: 'flex-start',
                opacity: banned ? 0.75 : 1,
              }}>
                <Avatar src={u.avatar_url} name={u.display_name || u.username || u.email} size={36} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                    {u.username ? (
                      <Link to={`/profile/${u.username}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', textDecoration: 'none' }}>
                        @{u.username}
                      </Link>
                    ) : (
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)' }}>{u.email}</span>
                    )}
                    <RoleBadge role={u.role} />
                    {banned && (
                      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 6, padding: '1px 6px' }}>
                        БАН{u.locked_until ? ` до ${new Date(u.locked_until).toLocaleDateString('ru-RU')}` : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    {u.email} · с {new Date(u.created_at).toLocaleDateString('ru-RU')}
                  </div>
                  {banned && u.ban_reason && (
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                      Причина: {u.ban_reason}{u.ban_by ? ` · ${u.ban_by}` : ''}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  {showRoleBtn && (
                    <button
                      onClick={() => setRoleTarget(u)}
                      disabled={busy}
                      style={actionBtnStyle('var(--text-2)', busy)}
                    >
                      {u.role === 'moderator' ? <><ShieldMinus size={13} /> Снять мод.</> : <><ShieldPlus size={13} /> В модераторы</>}
                    </button>
                  )}
                  {showBanBtns && (
                    banned ? (
                      <button onClick={() => setUnbanTarget(u)} disabled={busy} style={actionBtnStyle('var(--text-2)', busy)}>
                        <RotateCcw size={13} /> Разбанить
                      </button>
                    ) : (
                      <button onClick={() => setBanTarget(u)} disabled={busy} style={actionBtnStyle('var(--error)', busy)}>
                        <Ban size={13} /> Забанить
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {banTarget && (
        <BanModal
          username={banTarget.username ?? banTarget.email}
          pending={banUser.isPending}
          error={banUser.error ? (banUser.error as Error).message : null}
          onCancel={() => setBanTarget(null)}
          onConfirm={confirmBan}
        />
      )}

      {roleTarget && (
        <RoleModal
          username={roleTarget.username ?? roleTarget.email}
          nextRole={roleNext}
          pending={setRole.isPending}
          error={setRole.error ? (setRole.error as Error).message : null}
          onCancel={() => setRoleTarget(null)}
          onConfirm={confirmRole}
        />
      )}

      {unbanTarget && (
        <UnbanModal
          username={unbanTarget.username ?? unbanTarget.email}
          pending={unbanUser.isPending}
          error={unbanUser.error ? (unbanUser.error as Error).message : null}
          onCancel={() => setUnbanTarget(null)}
          onConfirm={confirmUnban}
        />
      )}
    </div>
  );
};

const actionBtnStyle = (color: string, busy: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'center',
  background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7,
  padding: '6px 11px', fontSize: 12, color, whiteSpace: 'nowrap',
  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.5 : 1,
});

export default AdminUsersPage;
