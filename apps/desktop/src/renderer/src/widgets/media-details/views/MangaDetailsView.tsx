import { MediaDetailsView, MediaDetailsViewProps } from './MediaDetailsView'

export type { DownloadStatus } from './MediaDetailsView'
export const MangaDetailsView = (props: MediaDetailsViewProps): React.JSX.Element => (
  <MediaDetailsView {...props} mediaType="manga" />
)
export default MangaDetailsView
