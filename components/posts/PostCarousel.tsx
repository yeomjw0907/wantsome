/**
 * 포스트 이미지 캐러셀 (최대 3장 좌우 스와이프)
 */
import React, { useRef, useState } from "react";
import {
  View,
  Image,
  ScrollView,
  Dimensions,
  StyleSheet,
} from "react-native";

const { width: SCREEN_W } = Dimensions.get("window");

interface Props {
  images: string[];
  width?: number;
  aspectRatio?: number;
}

export function PostCarousel({ images, width = SCREEN_W, aspectRatio = 1 }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const height = width / aspectRatio;

  const handleScroll = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(idx);
  };

  if (images.length === 0) return null;

  return (
    <View style={{ width, height }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEnabled={images.length > 1}
        style={{ width, height }}
      >
        {images.map((uri, idx) => (
          <Image
            key={idx}
            source={{ uri }}
            style={{ width, height }}
            resizeMode="cover"
          />
        ))}
      </ScrollView>

      {/* 페이지 인디케이터 */}
      {images.length > 1 && (
        <View style={styles.dots}>
          {images.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                { backgroundColor: idx === currentIndex ? "#fff" : "rgba(255,255,255,0.5)" },
              ]}
            />
          ))}
        </View>
      )}

      {/* 이미지 카운터 (우상단) */}
      {images.length > 1 && (
        <View style={styles.counter}>
          <View style={styles.counterBg}>
            {/* blank */}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  counter: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  counterBg: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
});
