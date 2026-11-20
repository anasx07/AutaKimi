import { MediaDetailsView, MediaDetailsViewProps } from './MediaDetailsView'

export type { DownloadStatus } from './MediaDetailsView'
export const AnimeDetailsView = (props: MediaDetailsViewProps): React.JSX.Element => (
  <MediaDetailsView {...props} mediaType="anime" />
)
export default AnimeDetailsView
