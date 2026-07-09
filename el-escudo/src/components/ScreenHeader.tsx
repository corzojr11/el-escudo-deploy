import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { BorderRadius, Spacing } from '../theme/spacing';
import { useAppStore } from '../store';

interface ScreenHeaderProps {
  title: string;
  showProfile?: boolean;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, showProfile = true }) => {
  const navigation = useNavigation<any>();
  const userProfile = useAppStore((state) => state.userProfile);

  return (
    <View style={styles.header}>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      {showProfile && (
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => navigation.navigate('Estado')}
          activeOpacity={0.7}
        >
          {userProfile?.avatar_url ? (
            <Image source={{ uri: userProfile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person-circle" size={32} color={Colors.accent.cyan} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, backgroundColor: Colors.bg.primary, borderBottomWidth: 1, borderBottomColor: Colors.border.subtle },
  title: { fontFamily: FontFamily.techSemi, fontSize: FontSize.lg, color: Colors.text.primary, letterSpacing: 1, flex: 1 },
  profileBtn: { padding: 2 },
  avatarImage: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: Colors.accent.cyan },
});
