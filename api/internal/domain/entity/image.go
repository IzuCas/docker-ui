package entity

import "time"

// Image represents a Docker image
type Image struct {
	ID          string
	RepoTags    []string
	RepoDigests []string
	Created     time.Time
	Size        int64
	VirtualSize int64
	Labels      map[string]string
	ParentID    string
	Containers  int64
}

// ImageSummary represents a summary of an image
type ImageSummary struct {
	ID          string
	RepoTags    []string
	RepoDigests []string
	Created     time.Time
	Size        int64
	Labels      map[string]string
}

// ImagePullOptions represents options for pulling an image
type ImagePullOptions struct {
	Image    string
	Tag      string
	Platform string
	Username string
	Password string
}

// ImageBuildOptions represents options for building an image
type ImageBuildOptions struct {
	Tags        []string
	Dockerfile  string
	BuildArgs   map[string]string
	NoCache     bool
	Remove      bool
	ForceRemove bool
}

// ImageHistory represents a layer in image history
type ImageHistory struct {
	ID        string
	Created   time.Time
	CreatedBy string
	Tags      []string
	Size      int64
	Comment   string
}

// ImageInspect represents detailed image information
type ImageInspect struct {
	ID            string
	RepoTags      []string
	RepoDigests   []string
	Parent        string
	Comment       string
	Created       time.Time
	Container     string
	DockerVersion string
	Author        string
	Architecture  string
	Os            string
	Size          int64
	VirtualSize   int64
	Config        ImageConfig
}

// ImageConfig represents image configuration
type ImageConfig struct {
	Hostname     string
	User         string
	ExposedPorts map[string]struct{}
	Env          []string
	Cmd          []string
	Volumes      map[string]struct{}
	WorkingDir   string
	Entrypoint   []string
	Labels       map[string]string
}
