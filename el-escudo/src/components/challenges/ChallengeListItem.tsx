import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { ChallengeResponse, ChallengeProgressEntry } from '../../types/api';

interface ChallengeListItemProps {
  challenge: ChallengeResponse;
  myProgress?: ChallengeProgressEntry;
  opponentProgress?: ChallengeProgressEntry;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onReportProgress?: () => void;
  onViewDetail?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'PENDIENTE', color: Colors.accent.orange, bg: Colors.accent.orange + '15' },
  accepted:  { label: 'EN CURSO',  color: Colors.accent.green,  bg: Colors.accent.green + '15' },
  completed: { label: 'COMPLETADO', color: Colors.accent.gold,   bg: Colors.accent.gold + '15' },
  failed:    { label: 'FALLIDO',   color: Colors.accent.red,    bg: Colors.accent.red + '15' },
  rejected:  { label: 'RECHAZADO', color: Colors.text.muted,    bg: Colors.text.muted + '15' },
  cancelled: { label: 'CANCELADO', color: Colors.text.muted,    bg: Colors.text.muted + '15' },
};

const ChallengeListItem: React.FC<ChallengeListItemProps> = ({
  challenge,
  myProgress,
  opponentProgress,
  onAccept,
  onReject,
  onCancel,
  onReportProgress,
  onViewDetail,
}) => {
  const isChallenged = challenge.challenged.player_id === (myProgress?.player_id || '');
  const isPending = challenge.status === 'pending';
  const isAccepted = challenge.status === 'accepted';
  const config = STATUS_CONFIG[challenge.status] || STATUS_CONFIG.pending;

  const target = challenge.template?.target_value || 1;
  const myValue = myProgress?.current_value || 0;
  const oppValue = opponentProgress?.current_value || 0;
  const myPct = Math.min(100, (myValue / target) * 100);
  const oppPct = Math.min(100, (oppValue / target) * 100);

  const opponentName = isChallenged ? challenge.challenger.name : challenge.challenged.name;

  const endsAt = challenge.ends_at ? new Date(challenge.ends_at) : null;
  const daysLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

  return (
    <TouchableOpacity style={styles.card} onPress={onViewDetail} activeOpacity={0.7}>
      {/* Status badge */}
      <View style={[styles.badge, { backgroundColor: config.bg }]}>
        <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
      </View>

      {/* VS header */}
      <View style={styles.vsHeader}>
        <View style={styles.playerInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{(myProgress?.name || 'T').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.playerName} numberOfLines={1}>{myProgress?.name || 'Tú'}</Text>
        </View>

        <View style={styles.vsBadge}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        <View style={[styles.playerInfo, styles.playerInfoOpponent]}>
          <Text style={[styles.playerName, styles.playerNameOpponent]} numberOfLines={1}>{opponentName}</Text>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{opponentName.charAt(0).toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Challenge name */}
      <Text style={styles.challengeName}>{challenge.template?.name || 'Reto'}</Text>

      {/* Progress bars */}
      {isAccepted && (
        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Tú</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${myPct}%`, backgroundColor: Colors.accent.cyan }]} />
            </View>
            <Text style={styles.progressValue}>{myValue}/{target}</Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Rival</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${oppPct}%`, backgroundColor: Colors.accent.gold }]} />
            </View>
            <Text style={styles.progressValue}>{oppValue}/{target}</Text>
          </View>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        {daysLeft !== null && isAccepted && (
          <View style={styles.footerItem}>
            <Ionicons name="hourglass-outline" size={12} color={Colors.text.muted} />
            <Text style={styles.footerText}>{daysLeft}d restantes</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {isPending && isChallenged && (
            <>
              <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={onReject} activeOpacity={0.7}>
                <Text style={styles.rejectText}>RECHAZAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={onAccept} activeOpacity={0.7}>
                <Text style={styles.acceptText}>ACEPTAR</Text>
              </TouchableOpacity>
            </>
          )}
          {isPending && !isChallenged && (
            <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelText}>CANCELAR</Text>
            </TouchableOpacity>
          )}
          {isAccepted && (
            <TouchableOpacity style={[styles.actionBtn, styles.reportBtn]} onPress={onReportProgress} activeOpacity={0.7}>
              <Ionicons name="sync-outline" size={12} color={Colors.accent.green} />
              <Text style={styles.reportText}>REPORTAR</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  vsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  playerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  playerInfoOpponent: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bg.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.xs,
    color: Colors.text.primary,
  },
  playerName: {
    fontFamily: FontFamily.techSemi,
    fontSize: FontSize.sm,
    color: Colors.text.primary,
    flex: 1,
  },
  playerNameOpponent: {
    textAlign: 'right',
  },
  vsBadge: {
    backgroundColor: Colors.accent.red + '20',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  vsText: {
    fontFamily: FontFamily.tech,
    fontSize: FontSize.xs,
    color: Colors.accent.red,
  },
  challengeName: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  progressSection: {
    gap: Spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  progressLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
    width: 36,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border.subtle,
    borderRadius: BorderRadius.xxs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.xxs,
  },
  progressValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.secondary,
    width: 44,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  acceptBtn: {
    borderColor: Colors.border.green,
    backgroundColor: Colors.accent.green + '15',
  },
  acceptText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.accent.green,
    fontWeight: '700',
  },
  rejectBtn: {
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.chip,
  },
  rejectText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  cancelBtn: {
    borderColor: Colors.border.default,
    backgroundColor: Colors.bg.chip,
  },
  cancelText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.text.muted,
  },
  reportBtn: {
    borderColor: Colors.border.green,
    backgroundColor: Colors.accent.green + '10',
  },
  reportText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.accent.green,
    fontWeight: '700',
  },
});

export default ChallengeListItem;
