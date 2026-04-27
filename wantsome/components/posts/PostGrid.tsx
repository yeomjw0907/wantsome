/**
 * 크리에이터 프로필 포스트 그리드 (3컬럼 정사각형)
 */
import React from "react";
import {
  View,
  Image,
  TouchableOpacity,
  Dimensions,
  Text,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_W } = Dimensions.get("window");
const CELL_SIZE = (SCREEN_W - 4) / 3; // 3컬럼, 간격 1px씩

export interface GridPost {
  id: string;
  thumbnail: string | null;
  image_count: number;
  like_count: number;
}

interface Props {
  posts: GridPost[];
  onPress?: (postId: string) => void;
}

export function PostGrid({ posts, onPress }: Props) {
  if (posts.length === 0) {
    return (
      <View style={{ paddingVertical: 40, alignItems: "center" }}>
        <Ionicons name="images-outline" size={36} color="#C8C8D8" />
        <Text style={{ color: "#9CA3AF", fontSize: 13, marginTop: 8 }}>
          아직 게시물이 없습니다
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {posts.map((post, idx) => (
        <TouchableOpacity
          key={post.id}
          onPress={() => onPress?.(post.id)}
          activeOpacity={0.85}
          style={{
            width: CELL_SIZE,
            height: CELL_SIZE,
            marginRight: idx % 3 === 2 ? 0 : 1,
            marginBottom: 1,
          }}
        >
          {post.thumbnail ? (
            <Image
              source={{ uri: post.thumbnail }}
              style={{ width: CELL_SIZE, height: CELL_SIZE }}
              resizeMode="cover"
            />
          ) : (
            <View style={{
              width: CELL_SIZE, height: CELL_SIZE,
              backgroundColor: "#F0F0F5",
              alignItems: "center", justifyContent: "center",
            }}>
              <Ionicons name="image-outline" size={24} color="#C8C8D8" />
            </View>
          )}

          {/* 이미지 여러 장 표시 */}
          {post.image_count > 1 && (
            <View style={{
              position: "absolute", top: 6, right: 6,
              backgroundColor: "rgba(0,0,0,0.5)",
              borderRadius: 4, padding: 2,
            }}>
              <Ionicons name="copy-outline" size={12} color="white" />
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}
