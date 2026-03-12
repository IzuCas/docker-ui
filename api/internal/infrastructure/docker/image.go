package docker

import (
	"context"
	"io"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/registry"
	"github.com/docker/docker/client"

	"app/example/internal/domain/entity"
)

type ImageClient struct {
	docker *client.Client
}

func NewImageClient(docker *client.Client) *ImageClient {
	return &ImageClient{docker: docker}
}

func (c *ImageClient) List(ctx context.Context, all bool) ([]entity.ImageSummary, error) {
	images, err := c.docker.ImageList(ctx, image.ListOptions{All: all})
	if err != nil {
		return nil, err
	}

	result := make([]entity.ImageSummary, len(images))
	for i, img := range images {
		result[i] = entity.ImageSummary{
			ID:          img.ID,
			RepoTags:    img.RepoTags,
			RepoDigests: img.RepoDigests,
			Created:     time.Unix(img.Created, 0),
			Size:        img.Size,
			Labels:      img.Labels,
		}
	}

	return result, nil
}

func (c *ImageClient) Inspect(ctx context.Context, id string) (*entity.ImageInspect, error) {
	img, _, err := c.docker.ImageInspectWithRaw(ctx, id)
	if err != nil {
		return nil, err
	}

	created, _ := time.Parse(time.RFC3339Nano, img.Created)

	exposedPorts := make(map[string]struct{})
	for port := range img.Config.ExposedPorts {
		exposedPorts[string(port)] = struct{}{}
	}

	volumes := make(map[string]struct{})
	for v := range img.Config.Volumes {
		volumes[v] = struct{}{}
	}

	return &entity.ImageInspect{
		ID:            img.ID,
		RepoTags:      img.RepoTags,
		RepoDigests:   img.RepoDigests,
		Parent:        img.Parent,
		Comment:       img.Comment,
		Created:       created,
		DockerVersion: img.DockerVersion,
		Author:        img.Author,
		Architecture:  img.Architecture,
		Os:            img.Os,
		Size:          img.Size,
		VirtualSize:   img.VirtualSize,
		Config: entity.ImageConfig{
			Hostname:     img.Config.Hostname,
			User:         img.Config.User,
			ExposedPorts: exposedPorts,
			Env:          img.Config.Env,
			Cmd:          img.Config.Cmd,
			Volumes:      volumes,
			WorkingDir:   img.Config.WorkingDir,
			Entrypoint:   img.Config.Entrypoint,
			Labels:       img.Config.Labels,
		},
	}, nil
}

func (c *ImageClient) Pull(ctx context.Context, refImage string, options entity.ImagePullOptions) error {
	ref := refImage
	if options.Tag != "" {
		ref = ref + ":" + options.Tag
	}

	pullOptions := image.PullOptions{}
	if options.Platform != "" {
		pullOptions.Platform = options.Platform
	}

	reader, err := c.docker.ImagePull(ctx, ref, pullOptions)
	if err != nil {
		return err
	}
	defer reader.Close()

	// Drain the reader to complete the pull
	_, err = io.Copy(io.Discard, reader)
	return err
}

func (c *ImageClient) Remove(ctx context.Context, id string, force bool, pruneChildren bool) ([]string, []string, error) {
	deleted, err := c.docker.ImageRemove(ctx, id, image.RemoveOptions{
		Force:         force,
		PruneChildren: pruneChildren,
	})
	if err != nil {
		return nil, nil, err
	}

	deletedIDs := make([]string, 0)
	untagged := make([]string, 0)
	for _, d := range deleted {
		if d.Deleted != "" {
			deletedIDs = append(deletedIDs, d.Deleted)
		}
		if d.Untagged != "" {
			untagged = append(untagged, d.Untagged)
		}
	}

	return deletedIDs, untagged, nil
}

func (c *ImageClient) Tag(ctx context.Context, source string, repo string, tag string) error {
	target := repo
	if tag != "" {
		target = repo + ":" + tag
	}
	return c.docker.ImageTag(ctx, source, target)
}

func (c *ImageClient) History(ctx context.Context, id string) ([]entity.ImageHistory, error) {
	history, err := c.docker.ImageHistory(ctx, id)
	if err != nil {
		return nil, err
	}

	result := make([]entity.ImageHistory, len(history))
	for i, h := range history {
		result[i] = entity.ImageHistory{
			ID:        h.ID,
			Created:   time.Unix(h.Created, 0),
			CreatedBy: h.CreatedBy,
			Tags:      h.Tags,
			Size:      h.Size,
			Comment:   h.Comment,
		}
	}

	return result, nil
}

func (c *ImageClient) Search(ctx context.Context, term string, limit int) ([]registry.SearchResult, error) {
	return c.docker.ImageSearch(ctx, term, types.ImageSearchOptions{Limit: limit})
}

func (c *ImageClient) Prune(ctx context.Context, all bool) ([]string, int64, error) {
	args := filters.NewArgs()
	if !all {
		args.Add("dangling", "true")
	}

	report, err := c.docker.ImagesPrune(ctx, args)
	if err != nil {
		return nil, 0, err
	}

	deleted := make([]string, len(report.ImagesDeleted))
	for i, img := range report.ImagesDeleted {
		if img.Deleted != "" {
			deleted[i] = img.Deleted
		} else {
			deleted[i] = img.Untagged
		}
	}

	return deleted, int64(report.SpaceReclaimed), nil
}
