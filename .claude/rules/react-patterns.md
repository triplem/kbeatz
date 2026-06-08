# Rule: React Patterns

## Component File Structure

One component per file. File name matches the component name in kebab-case. Co-locate styles, tests, and types with the component.

```
src/features/albums/
  AlbumGrid.tsx          # component
  AlbumGrid.test.tsx     # tests
  AlbumGrid.module.css   # styles (if not using Tailwind)
  useAlbumGrid.ts        # custom hook extracted from the component
  album.types.ts         # types used only by this feature
```

Export components as named exports, not default exports:

```typescript
// GOOD - named export; importable without aliasing
export function AlbumGrid({ albums }: AlbumGridProps) { ... }

// BAD - default export; import name can diverge from file name
export default function AlbumGrid({ albums }: AlbumGridProps) { ... }
```

## Custom Hook Design and Naming

Hooks must start with `use`. Extract all data-fetching and non-trivial business logic into custom hooks; keep components as thin renderers.

```typescript
// GOOD - hook owns the fetch; component receives clean state
function useAlbum(id: string) {
  return useQuery({
    queryKey: ['album', id],
    queryFn: () => albumApi.getAlbumById({ id }),
  });
}

function AlbumDetail({ id }: { id: string }) {
  const { data: album, isPending, isError } = useAlbum(id);
  if (isPending) return <Spinner />;
  if (isError || !album) return <ErrorMessage />;
  return <AlbumView album={album} />;
}

// BAD - component mixes fetching with rendering
function AlbumDetail({ id }: { id: string }) {
  const [album, setAlbum] = useState<Album | null>(null);
  useEffect(() => {
    albumApi.getAlbumById({ id }).then(setAlbum);
  }, [id]);
  return album ? <AlbumView album={album} /> : <Spinner />;
}
```

### Hook return shapes

Return an object from hooks with more than one value, not a tuple. Object destructuring scales better when the hook grows:

```typescript
// GOOD - named fields; callers pick what they need
function useAlbumSearch() {
  return { results, query, setQuery, isPending };
}
const { results, isPending } = useAlbumSearch();

// BAD - positional tuple; breaks on extension
function useAlbumSearch(): [Album[], string, (q: string) => void, boolean] { ... }
const [results, , , isPending] = useAlbumSearch();
```

### One concern per hook

A hook should do one thing. Compose small hooks rather than writing one large hook:

```typescript
// GOOD - composed from focused hooks
function useAlbumEditPage(id: string) {
  const album = useAlbum(id);
  const form = useAlbumForm(album.data);
  const save = useSaveAlbum(id);
  return { album, form, save };
}

// BAD - one hook managing fetch, form, validation, and submit
function useAlbumEditPage(id: string) {
  // 80 lines mixing server state, local form state, and validation
}
```

## React Context Patterns

Use Context for values that are truly global within a subtree: theme, current user, locale. Do not use Context as a general-purpose state store.

### Provider pattern

Always co-locate the context definition, provider, and consumer hook in one file:

```typescript
// GOOD - single file; consumer hook hides context internals
interface LibraryContextValue {
  root: string;
  scanStatus: ScanStatus;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ root, children }: { root: string; children: ReactNode }) {
  const scanStatus = useScanStatus(root);
  return (
    <LibraryContext.Provider value={{ root, scanStatus }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}

// BAD - context exported raw; consumers call useContext directly and forget the null guard
export const LibraryContext = createContext<LibraryContextValue | null>(null);
// ... somewhere else ...
const ctx = useContext(LibraryContext); // null if provider is missing - silent bug
```

### Context vs TanStack Query vs Zustand

| Need | Tool |
|---|---|
| Server state (API data) | TanStack Query |
| Global client-only state | Zustand |
| Shared subtree configuration | React Context |
| Local ephemeral UI state | `useState` |

Do not use Context to share server state; use TanStack Query for that instead.

## Component Composition and Prop Typing

### Prefer composition over configuration

Split a complex component into focused sub-components instead of adding boolean flags:

```typescript
// GOOD - composable; each part can vary independently
function AlbumCard({ album }: { album: Album }) {
  return (
    <Card>
      <AlbumCover src={album.coverUrl} alt={album.title} />
      <AlbumMeta title={album.title} artist={album.artist} year={album.year} />
    </Card>
  );
}

// BAD - boolean flags grow unbounded
function AlbumCard({ album, showCover, compact, editable }: AlbumCardProps) {
  return (
    <div>
      {showCover && <img src={album.coverUrl} />}
      {compact ? <span>{album.title}</span> : <h2>{album.title}</h2>}
      {editable && <EditButton />}
    </div>
  );
}
```

### Explicit prop types

Always declare a named interface for component props. Inline types hide the shape and cannot be reused:

```typescript
// GOOD
interface AlbumMetaProps {
  title: string;
  artist: string;
  year: number;
  className?: string;
}

function AlbumMeta({ title, artist, year, className }: AlbumMetaProps) { ... }

// BAD - inline anonymous type
function AlbumMeta({ title, artist, year }: { title: string; artist: string; year: number }) { ... }
```

### Children typing

Use `ReactNode` for generic children slots; use a specific type when the slot has a constrained shape:

```typescript
// Slot that accepts any React content
interface CardProps {
  children: ReactNode;
}

// Slot that must receive a specific element
interface FieldProps {
  label: string;
  input: ReactElement<HTMLInputElement>;
}
```

### Event handler typing

Prefer `React.MouseEventHandler<HTMLButtonElement>` and similar built-in types over `(e: MouseEvent) => void`:

```typescript
interface ActionButtonProps {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
}
```

## State Management

Choose the narrowest state scope that satisfies the requirement.

```
useState         - local ephemeral UI state (open/closed, current page, input value)
useReducer       - local state with multiple sub-values or complex transitions
React Context    - shared subtree config that changes infrequently
TanStack Query   - any data fetched from the server
Zustand          - global client state that is not server state (e.g. selected track)
```

### Local state first

Start with `useState`. Lift only when two sibling components need the same value:

```typescript
// GOOD - state lives in the lowest common ancestor
function AlbumPage({ id }: { id: string }) {
  const [selectedTrackIndex, setSelectedTrackIndex] = useState(0);
  return (
    <>
      <TrackList tracks={album.tracks} selected={selectedTrackIndex} onSelect={setSelectedTrackIndex} />
      <TrackDetail track={album.tracks[selectedTrackIndex]} />
    </>
  );
}

// BAD - global store used for ephemeral page-level selection
const useStore = create(set => ({
  selectedTrackIndex: 0,
  setSelectedTrackIndex: (i: number) => set({ selectedTrackIndex: i }),
}));
```

### No derived state in state

Compute derived values inline or with `useMemo`. Never store a value that can be derived from existing state:

```typescript
// GOOD - filteredAlbums is computed, not stored
const filteredAlbums = useMemo(
  () => albums.filter(a => a.artist.toLowerCase().includes(query.toLowerCase())),
  [albums, query],
);

// BAD - filteredAlbums duplicates albums + query into a third state variable
const [filteredAlbums, setFilteredAlbums] = useState<Album[]>([]);
useEffect(() => {
  setFilteredAlbums(albums.filter(a => a.artist.toLowerCase().includes(query.toLowerCase())));
}, [albums, query]);
```

### Server state via TanStack Query

Never use `useEffect` to fetch data. TanStack Query handles caching, background refresh, and loading/error states:

```typescript
// GOOD
const { data: albums, isPending } = useQuery({
  queryKey: ['albums'],
  queryFn: () => albumsApi.getAlbums({ page: 0, size: 20 }),
});

// BAD
const [albums, setAlbums] = useState<Album[]>([]);
const [isPending, setIsPending] = useState(false);
useEffect(() => {
  setIsPending(true);
  albumsApi.getAlbums({ page: 0, size: 20 })
    .then(r => setAlbums(r.content))
    .finally(() => setIsPending(false));
}, []);
```

## Anti-patterns

- No business logic in JSX: move conditional transformations to the hook or a helper function.
- No prop drilling beyond 2 levels: lift state or use Context.
- No `index` as `key` in dynamic lists: use a stable, unique id from the data.
- No inline object or function literals as props on frequently re-rendered components: they create a new reference every render and defeat `memo()`.
- No `useEffect` for data fetching: use TanStack Query.
- No `useCallback` / `useMemo` by default: add them only after profiling confirms a performance problem.
