import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  Pressable,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { JOKE_API_URL } from "@env";

const ListSection = ({
  item,
  expanded,
  onPress,
  onScrollToTop,
  isFirstItem,
  onChildPress,
  onAddItem,
  addedItemsCount,
  isLoading,
}) => {
  const canAddMore = addedItemsCount < 2;

  return (
    <View>
      <TouchableOpacity style={styles.sectionHeader} onPress={onPress}>
        <Text style={styles.sectionHeaderText}>{item.title}</Text>
        <View style={styles.headerRight}>
          {!isFirstItem && (
            <TouchableOpacity onPress={onScrollToTop} style={styles.topButton}>
              <Text style={styles.topButtonText}>Go to Top</Text>
            </TouchableOpacity>
          )}
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-forward"}
            size={20}
            color="#666"
          />
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.childrenContainer}>
          {isLoading ? (
            <ActivityIndicator style={styles.loader} color="#007AFF" />
          ) : (
            <>
              {item.children?.map((child) => (
                <TouchableOpacity
                  key={child.id}
                  style={styles.childItem}
                  onPress={() => onChildPress(child.joke)}
                >
                  <Text style={styles.childText} numberOfLines={2}>
                    {child.joke}
                  </Text>
                </TouchableOpacity>
              ))}
              {canAddMore && (
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() => onAddItem(item.title)}
                >
                  <Text style={styles.addButtonText}>Add New Joke</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
};

export default function Index() {
  // State for managing categories and their jokes
  const [categories, setCategories] = useState([]);
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [modalInfo, setModalInfo] = useState({
    visible: false,
    title: "",
    type: "display", // 'display' for viewing jokes, 'input' for adding new ones
  });
  const [newItemText, setNewItemText] = useState("");
  const [addedItems, setAddedItems] = useState({}); // Tracks custom jokes added per category
  const [refreshing, setRefreshing] = useState(false);
  const [loadingJokes, setLoadingJokes] = useState({}); // Tracks loading state per category
  const flatListRef = useRef(null);

  /**
   * Fetches joke categories from the API and then fetches jokes for each category
   */
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${JOKE_API_URL}/categories`);
      const data = await response.json();

      const formattedCategories = data.categories.map((cat) => ({
        id: cat,
        title: cat,
        children: [],
      }));

      // Set initial categories
      setCategories(formattedCategories);

      // Fetch jokes for each category
      await Promise.all(
        data.categories.map(async (category) => {
          setLoadingJokes((prev) => ({ ...prev, [category]: true }));
          try {
            const jokeResponse = await fetch(
              `${JOKE_API_URL}/joke/${category}?type=single&amount=2`
            );
            const jokeData = await jokeResponse.json();

            if (jokeData.jokes) {
              setCategories((prevCategories) => {
                const updatedCategories = [...prevCategories];
                const categoryIndex = updatedCategories.findIndex(
                  (cat) => cat.title === category
                );

                if (categoryIndex !== -1) {
                  updatedCategories[categoryIndex].children =
                    jokeData.jokes.map((joke, index) => ({
                      id: `${category}-${index}`,
                      joke: joke.joke,
                    }));
                }
                return updatedCategories;
              });
            }
          } catch (error) {
            // Keep only error logging
            console.error(`Error fetching jokes for ${category}:`, error);
          } finally {
            setLoadingJokes((prev) => ({ ...prev, [category]: false }));
          }
        })
      );
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  /**
   * Fetches jokes for a specific category
   * @param {string} category - The category to fetch jokes for
   */
  const fetchJokes = async (category) => {
    setLoadingJokes((prev) => ({ ...prev, [category]: true }));
    try {
      const response = await fetch(
        `${JOKE_API_URL}/joke/${category}?type=single&amount=2`
      );
      const data = await response.json();

      if (data.jokes) {
        const categoryIndex = categories.findIndex(
          (cat) => cat.title === category
        );
        if (categoryIndex !== -1) {
          const updatedCategories = [...categories];
          // Get existing custom jokes (ones with 'custom' in their id)
          const customJokes = updatedCategories[categoryIndex].children.filter(
            (joke) => joke.id.includes("custom")
          );

          // Combine API jokes with existing custom jokes
          updatedCategories[categoryIndex].children = [
            ...data.jokes.map((joke, index) => ({
              id: `${category}-${index}`,
              joke: joke.joke,
            })),
            ...customJokes, // Preserve custom jokes
          ];

          setCategories(updatedCategories);
        }
      }
    } catch (error) {
      console.error(`Error fetching jokes for ${category}:`, error);
    } finally {
      setLoadingJokes((prev) => ({ ...prev, [category]: false }));
    }
  };

  // Initial fetch of categories when component mounts
  useEffect(() => {
    fetchCategories();
  }, []);

  /**
   * Handles pull-to-refresh
   * Resets added items and fetches fresh categories
   */
  const onRefresh = () => {
    setRefreshing(true);
    setAddedItems({});
    fetchCategories().finally(() => {
      setRefreshing(false);
    });
  };

  /**
   * Scrolls the list to the top with animation and collapses all expanded sections
   */
  const scrollToTop = () => {
    // Create a new empty Set to collapse all sections
    const emptySet = new Set();
    setExpandedSections(emptySet);
    // Scroll to top
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  /**
   * Toggles section expansion and fetches jokes if needed
   * @param {string} category - The category to toggle
   */
  const toggleSection = async (category) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
        // Only fetch jokes if the category has no children
        const categoryData = categories.find((cat) => cat.title === category);
        if (categoryData && categoryData.children.length === 0) {
          fetchJokes(category);
        }
      }
      return newSet;
    });
  };

  /**
   * Shows modal with the full joke text
   * @param {string} joke - The joke text to display
   */
  const handleChildPress = (joke) => {
    setModalInfo({
      visible: true,
      title: joke,
      type: "display",
    });
  };

  /**
   * Shows input modal for adding a new joke
   * @param {string} category - The category to add joke to
   */
  const handleAddItem = (category) => {
    setModalInfo({
      visible: true,
      title: "Add New Joke",
      type: "input",
      parentId: category,
    });
  };

  /**
   * Adds a new custom joke to a category
   * Limited to 2 custom jokes per category
   */
  const handleAddNewItem = () => {
    if (modalInfo.parentId && newItemText.trim()) {
      const categoryIndex = categories.findIndex(
        (cat) => cat.title === modalInfo.parentId
      );
      if (categoryIndex !== -1) {
        const updatedCategories = [...categories];
        const newJoke = {
          id: `${modalInfo.parentId}-custom-${Date.now()}`,
          joke: newItemText.trim(),
        };
        updatedCategories[categoryIndex].children.push(newJoke);

        setCategories(updatedCategories);

        setAddedItems((prev) => ({
          ...prev,
          [modalInfo.parentId]: (prev[modalInfo.parentId] || 0) + 1,
        }));

        setNewItemText("");
        setModalInfo({ visible: false, title: "", type: "display" });
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* FlatList for rendering categories */}
      <FlatList
        ref={flatListRef}
        data={categories}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ListSection
            item={item}
            expanded={expandedSections.has(item.title)}
            onPress={() => toggleSection(item.title)}
            onScrollToTop={scrollToTop}
            isFirstItem={index === 0}
            onChildPress={handleChildPress}
            onAddItem={handleAddItem}
            addedItemsCount={addedItems[item.title] || 0}
            isLoading={loadingJokes[item.title]}
          />
        )}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#007AFF"
            colors={["#007AFF"]}
            title="Pull to refresh"
          />
        }
      />

      {/* Modal for displaying jokes and adding new ones */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalInfo.visible}
        onRequestClose={() =>
          setModalInfo({ visible: false, title: "", type: "display" })
        }
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() =>
            setModalInfo({ visible: false, title: "", type: "display" })
          }
        >
          <View style={styles.modalContent}>
            {modalInfo.type === "display" ? (
              <>
                <Text style={styles.modalTitle}>{modalInfo.title}</Text>
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() =>
                    setModalInfo({ visible: false, title: "", type: "display" })
                  }
                >
                  <Text style={styles.modalButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Add New Item</Text>
                <TextInput
                  style={styles.input}
                  value={newItemText}
                  onChangeText={setNewItemText}
                  placeholder="Enter item name"
                  autoFocus
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setNewItemText("");
                      setModalInfo({
                        visible: false,
                        title: "",
                        type: "display",
                      });
                    }}
                  >
                    <Text
                      style={[styles.modalButtonText, styles.cancelButtonText]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={handleAddNewItem}
                  >
                    <Text style={styles.modalButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f6f6",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
    borderRadius: 10,
    marginBottom: 8,
    // Add shadow for iOS
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    // Add elevation for Android
    elevation: 2,
  },
  sectionHeaderText: {
    fontSize: 17,
    fontWeight: "500",
  },
  childrenContainer: {
    backgroundColor: "#fff",
    marginBottom: 8,
    borderRadius: 10,
    overflow: "hidden",
    // Add shadow for iOS
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    // Add elevation for Android
    elevation: 2,
  },
  childItem: {
    padding: 16,
    paddingLeft: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ccc",
  },
  childText: {
    fontSize: 16,
    color: "#333",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  topButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "300",
    marginBottom: 20,
    textAlign: "center",
  },
  modalButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  modalButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  addButton: {
    padding: 16,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ccc",
  },
  addButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "500",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    color: "#007AFF",
  },
  loader: {
    padding: 20,
  },
});
