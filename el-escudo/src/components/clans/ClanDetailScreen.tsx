import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';
import { Spacing, BorderRadius } from '../../theme/spacing';
import { ClanDetailResponse, ClanMember, ClanMission } from '../../types/api';
import { apiPost } from '../../api/requests';
import ClanMissionCard from './ClanMissionCard';
import ClanProgressModal from './ClanProgressModal';
import ClanMissionCreateModal from './ClanMissionCreateModal';

interface ClanDetailScreenProps {
  clan: ClanDetailResponse;
  myRole?: string;
  myPlayerId?: string;
  onRefresh: () => void;
  onLeave?: () => void;
}

const ROLE_CONFIG: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; label: string }> = {
  owner:  { icon: 'diamond',     color: '#FFD700', label: 'OWNER' },
  admin:  { icon: 'flash',       color: Colors.accent.cyan, label: 'ADMIN' },
  member: { icon: 'person',      color: Colors.text.muted, label: 'MIEMBRO' },
};

const ClanDetailScreen: React.FC<ClanDetailScreenProps> = ({ clan, myRole, myPlayerId, onRefresh, onLeave }) => {
  const [progressModal, setProgressModal] = useState<{ visible: boolean; mission: ClanMission | null }>({ visible: false, mission: null });
  const [createMissionModal, setCreateMissionModal] = useState(false);
  const [kicking, setKicking] = useState<string | null>(null);

  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin';
  const canManage = isOwner || isAdmin;

  const handleKick = useCallback(async (playerId: string, playerName: string) => {
    Alert.alert(
      'Expulsar miembro',
      `¿Estás seguro de expulsar a ${playerName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Expulsar',
          style: 'destructive',
          onPress: async () => {
            setKicking(playerId);
            try {
              const res = await apiPost(`/api/v1/clans/${clan.id}/kick`, { player_id: playerId });
              if (res.ok) {
                Alert.alert('Expulsado', `${playerName} ha sido expulsado del clan.`);
                onRefresh();
              } else {
                const data = await res.json().catch(() => null);
                Alert.alert('Error', data?.detail || 'No se pudo expulsar.');
              }
            } catch (err) {
              Alert.alert('Error', 'No se pudo conectar.');
            } finally {
              setKicking(null);
            }
          },
        },
      ]
    );
  }, [clan.id, onRefresh]);

  const handleLeave = useCallback(() => {
    Alert.alert(
      'Salir del clan',
      '¿Estás seguro de que quieres salir del clan?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiPost(`/api/v1/clans/${clan.id}/leave`, {});
              if (res.ok) {
                Alert.alert('Has salido', 'Ya no eres miembro del clan.');
                onLeave?.();
              } else {
                const data = await res.json().catch(() => null);
                Alert.alert('Error', data?.detail || 'No se pudo salir.');
              }
            } catch (err) {
              Alert.alert('Error', 'No se pudo conectar.');
            }
          },
        },
      ]
    );
  }, [clan.id, onLeave]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={[styles.headerCard, { borderColor: clan.color + '60' }]}>
        <View style={[styles.colorBar, { backgroundColor: clan.color }]} />
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            {clan.tag && (
              <View style={[styles.tagBadge, { backgroundColor: clan.color + '30' }]}>
                <Text style={[styles.tagText, { color: clan.color }]}>{clan.tag}</Text>
              </View>
            )}
            <View style={styles.memberCount}>
              <Ionicons name="people-outline" size={14} color={Colors.text.muted} />
              <Text style={styles.memberText}>{clan.member_count}/{clan.max_members}</Text>
            </View>
          </View>
          <Text style={styles.clanName}>{clan.name}</Text>
          {clan.description && (
            <Text style={styles.clanDesc}>{clan.description}</Text>
          )}
          <View style={styles.xpRow}>
            <Ionicons name="diamond-outline" size={14} color={Colors.accent.gold} />
            <Text style={styles.xpText}>{clan.total_xp.toLocaleString()} XP total</Text>
          </View>
        </View>
      </View>

      {/* Members */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MIEMBROS ({clan.member_count})</Text>
        {clan.members.map((member: ClanMember) => {
          const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
          const isMe = member.player_id === myPlayerId;

          return (
            <View key={member.player_id} style={[styles.memberRow, isMe && styles.memberRowMe]}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarLetter}>{member.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, isMe && styles.memberNameMe]}>
                  {member.name}
                  {isMe && <Text style={styles.meBadge}> · TÚ</Text>}
                </Text>
                <View style={styles.memberMeta}>
                  <View style={[styles.roleBadge, { backgroundColor: roleConfig.color + '20' }]}>
                    <Ionicons name={roleConfig.icon} size={8} color={roleConfig.color} />
                    <Text style={[styles.roleText, { color: roleConfig.color }]}>{roleConfig.label}</Text>
                  </View>
                  <Text style={styles.contributedText}>{member.contributed_xp.toLocaleString()} XP</Text>
                </View>
              </View>
              {canManage && member.role !== 'owner' && !isMe && (
                <TouchableOpacity
                  style={[styles.kickBtn, kicking === member.player_id && styles.kickBtnDisabled]}
                  onPress={() => handleKick(member.player_id, member.name)}
                  disabled={kicking === member.player_id}
                  activeOpacity={0.7}
                >
                  {kicking === member.player_id ? (
                    <ActivityIndicator size="small" color={Colors.accent.red} />
                  ) : (
                    <Ionicons name="close-circle-outline" size={18} color={Colors.accent.red} />
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* Missions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>MISIONES ACTIVAS</Text>
          {canManage && (
            <TouchableOpacity
              style={[styles.createMissionBtn, { borderColor: clan.color + '40' }]}
              onPress={() => setCreateMissionModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={14} color={clanColor} />
              <Text style={[styles.createMissionText, { color: clanColor }]}>CREAR</Text>
            </TouchableOpacity>
          )}
        </View>

        {clan.missions.length === 0 ? (
          <View style={styles.emptyMissions}>
            <Ionicons name="flag-outline" size={24} color={Colors.text.muted} />
            <Text style={styles.emptyMissionsText}>Sin misiones activas</Text>
          </View>
        ) : (
          clan.missions.map((mission: ClanMission) => (
            <ClanMissionCard
              key={mission.id}
              mission={mission}
              clanColor={clan.color}
              canReport={!!myRole && myRole !== 'pending'}
              onReportProgress={() => setProgressModal({ visible: true, mission })}
            />
          ))
        )}
      </View>

      {/* Leave button */}
      {myRole && myRole !== 'owner' && (
        <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={16} color={Colors.accent.red} />
          <Text style={styles.leaveText}>SALIR DEL CLAN</Text>
        </TouchableOpacity>
      )}

      {/* Modals */}
      {progressModal.mission && (
        <ClanProgressModal
          visible={progressModal.visible}
          clanId={clan.id}
          mission={progressModal.mission}
          clanColor={clan.color}
          onClose={() => setProgressModal({ visible: false, mission: null })}
          onSuccess={() => onRefresh()}
        />
      )}

      <ClanMissionCreateModal
        visible={createMissionModal}
        clanId={clan.id}
        clanColor={clan.color}
        onClose={() => setCreateMissionModal(false)}
        onSuccess={onRefresh}
      />
    </ScrollView>
  );
};

const clanColor = '#00D4FF';

const styles = StyleSheet.create({
  content: { padding: Spacing.base, gap: Spacing.lg },
  headerCard: {
    backgroundColor: Colors.bg.card,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  colorBar: { height: 3 },
  headerContent: { padding: Spacing.md, gap: Spacing.sm },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tagBadge: { paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontFamily: FontFamily.tech, fontSize: FontSize.xs, fontWeight: '700' },
  memberCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  memberText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted },
  clanName: { fontFamily: FontFamily.tech, fontSize: FontSize.xl, color: Colors.text.primary },
  clanDesc: { fontFamily: FontFamily.sans, fontSize: FontSize.sm, color: Colors.text.muted, lineHeight: 20 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  xpText: { fontFamily: FontFamily.tech, fontSize: FontSize.sm, color: Colors.accent.gold },
  section: { gap: Spacing.sm },
  sectionTitle: { fontFamily: FontFamily.techSemi, fontSize: FontSize.xs, color: Colors.accent.cyan, letterSpacing: 1.5 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  createMissionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md, borderWidth: 1 },
  createMissionText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, fontWeight: '700' },
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.default, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  memberRowMe: { borderColor: Colors.border.cyan },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg.chip, alignItems: 'center', justifyContent: 'center' },
  memberAvatarLetter: { fontFamily: FontFamily.techSemi, fontSize: FontSize.sm, color: Colors.text.primary },
  memberInfo: { flex: 1, gap: 4 },
  memberName: { fontFamily: FontFamily.techSemi, fontSize: FontSize.sm, color: Colors.text.primary },
  memberNameMe: { color: Colors.accent.cyan },
  meBadge: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.accent.cyan },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: 4 },
  roleText: { fontFamily: FontFamily.mono, fontSize: 9, fontWeight: '700' },
  contributedText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted },
  kickBtn: { padding: 4 },
  kickBtnDisabled: { opacity: 0.5 },
  emptyMissions: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.xs },
  emptyMissionsText: { fontFamily: FontFamily.mono, fontSize: FontSize.xs, color: Colors.text.muted },
  leaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.accent.red + '40', borderRadius: BorderRadius.lg, paddingVertical: Spacing.base, marginTop: Spacing.sm },
  leaveText: { fontFamily: FontFamily.mono, fontSize: FontSize.base, color: Colors.accent.red, fontWeight: '700', letterSpacing: 1 },
});

export default ClanDetailScreen;
